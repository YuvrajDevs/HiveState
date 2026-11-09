-- Background execution queue, workflow versions, run variables, re-runs, share links and streamed steps.
-- Idempotent and additive: safe to apply to a database that is already serving the previous app version.

-- ---------------------------------------------------------------------------
-- Runs: new states and columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS input_overrides JSONB NOT NULL DEFAULT '{}'::jsonb, -- step input edited by a human before a retry
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER,
  ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rerun_from_node_id TEXT,
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_share_token ON public.runs(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON public.runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON public.runs(status);

ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('queued','running','paused_hitl','paused_error','resumed','completed','aborted','failed','stopped'));

-- ---------------------------------------------------------------------------
-- Logs: a step row exists while the step runs, so its output can stream into it
-- ---------------------------------------------------------------------------
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS logs_status_check;
ALTER TABLE public.logs ADD CONSTRAINT logs_status_check
  CHECK (status IN ('running','success','failed','paused_hitl','paused_error'));

CREATE INDEX IF NOT EXISTS idx_logs_run_created ON public.logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);

-- Today's spend is read on every run and every level; keep it an index range scan.
CREATE OR REPLACE FUNCTION public.get_today_spend()
RETURNS NUMERIC
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(step_cost), 0) FROM public.logs WHERE created_at >= CURRENT_DATE;
$$;
REVOKE EXECUTE ON FUNCTION public.get_today_spend() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Workflow versions: every save that changes the canvas creates an immutable snapshot
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  canvas_json JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version)
);
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

-- Saves the canvas and appends a version only if it changed. The row lock on the workflow serialises
-- concurrent saves so two tabs cannot both claim version N+1.
CREATE OR REPLACE FUNCTION public.save_workflow_version(p_workflow_id UUID, p_canvas JSONB, p_note TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_current INTEGER;
  v_latest JSONB;
BEGIN
  SELECT name, current_version INTO v_name, v_current FROM public.workflows WHERE id = p_workflow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workflow % not found', p_workflow_id;
  END IF;

  SELECT canvas_json INTO v_latest FROM public.workflow_versions
   WHERE workflow_id = p_workflow_id ORDER BY version DESC LIMIT 1;

  IF v_latest IS NOT NULL AND v_latest = p_canvas THEN
    UPDATE public.workflows SET canvas_json = p_canvas, updated_at = now() WHERE id = p_workflow_id;
    RETURN v_current;
  END IF;

  v_current := COALESCE((SELECT MAX(version) FROM public.workflow_versions WHERE workflow_id = p_workflow_id), 0) + 1;
  INSERT INTO public.workflow_versions (workflow_id, version, name, canvas_json, note)
  VALUES (p_workflow_id, v_current, v_name, p_canvas, p_note);
  UPDATE public.workflows SET canvas_json = p_canvas, current_version = v_current, updated_at = now() WHERE id = p_workflow_id;
  RETURN v_current;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_workflow_version(UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- Templates used retired model IDs; point them at current ones (the app also aliases them at runtime).
UPDATE public.workflows
   SET canvas_json = replace(replace(replace(canvas_json::text,
         '"gemini-1.5-flash"', '"gemini-2.5-flash-lite"'),
         '"gemini-1.5-pro"', '"gemini-2.5-pro"'),
         '"gemini-2.0-flash"', '"gemini-2.5-flash"')::jsonb
 WHERE canvas_json::text ~ '"gemini-(1\.5|2\.0)-';

-- Existing workflows start with their current canvas as version 1.
INSERT INTO public.workflow_versions (workflow_id, version, name, canvas_json, note)
SELECT w.id, 1, w.name, w.canvas_json, 'Initial version'
  FROM public.workflows w
 WHERE w.canvas_json IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.workflow_versions v WHERE v.workflow_id = w.id);
UPDATE public.workflows w SET current_version = 1
 WHERE current_version = 0 AND EXISTS (SELECT 1 FROM public.workflow_versions v WHERE v.workflow_id = w.id);

-- ---------------------------------------------------------------------------
-- Run queue: Postgres as the broker (FOR UPDATE SKIP LOCKED), no extra infrastructure
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.run_jobs (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('run','resume')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.run_jobs ENABLE ROW LEVEL SECURITY;

-- At most one live job per run: double-clicking "Resume" cannot start two executions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_run_jobs_one_live_per_run ON public.run_jobs(run_id) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS idx_run_jobs_claimable ON public.run_jobs(run_after, id) WHERE status = 'queued';

CREATE OR REPLACE FUNCTION public.enqueue_run_job(p_run_id UUID, p_kind TEXT)
RETURNS SETOF public.run_jobs
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.run_jobs (run_id, kind) VALUES (p_run_id, p_kind)
  ON CONFLICT (run_id) WHERE status IN ('queued','running') DO NOTHING
  RETURNING *;
$$;

-- Claims the oldest runnable job, or one whose worker's lease expired.
CREATE OR REPLACE FUNCTION public.claim_run_job(p_worker TEXT, p_lease_seconds INTEGER DEFAULT 330)
RETURNS SETOF public.run_jobs
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.run_jobs j
     SET status = 'running', locked_at = now(), locked_by = p_worker, attempts = j.attempts + 1, updated_at = now()
   WHERE j.id = (
     SELECT id FROM public.run_jobs
      WHERE (status = 'queued' AND run_after <= now())
         OR (status = 'running' AND locked_at < now() - make_interval(secs => p_lease_seconds))
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT 1)
  RETURNING j.*;
$$;

CREATE OR REPLACE FUNCTION public.fail_run_job(p_id BIGINT, p_error TEXT, p_retry_in_seconds INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  UPDATE public.run_jobs
     SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
         last_error = p_error,
         locked_at = NULL,
         locked_by = NULL,
         run_after = now() + make_interval(secs => p_retry_in_seconds),
         updated_at = now()
   WHERE id = p_id
  RETURNING status INTO v_status;
  RETURN COALESCE(v_status, 'dead');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_run_job(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_run_job(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_run_job(BIGINT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
