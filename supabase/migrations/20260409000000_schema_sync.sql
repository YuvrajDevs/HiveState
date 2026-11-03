-- Schema sync: brings a database built from the earlier migrations in line with what the app code reads and writes.
-- Idempotent. Found by running every screen and action of the app against a fresh database.
--
-- Notes on the earlier migrations when replaying them on an EMPTY database:
--   * 20260407172500 and 20260407174500 both add runs/logs to the supabase_realtime publication; the second fails.
--   * 20260408010000_seeding_demo uses ids that are not valid UUIDs and columns created only by this file.
--   * 20260408030000 makes runs.paused_node_id a UUID foreign key to agents, but the engine stores canvas node ids (text).
-- Apply the earlier files (skipping the duplicate publication lines and the demo seed), then this one.

-- Columns used by the application
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS canvas_json JSONB;

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS circuit_breaker_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consecutive_failures_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error TEXT;

-- Canvas node ids are strings, not agent UUIDs, so this cannot be a foreign key.
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS paused_node_id TEXT;
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_paused_node_id_fkey;
ALTER TABLE public.runs ALTER COLUMN paused_node_id TYPE TEXT USING paused_node_id::text;

ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS input_payload TEXT,
  ADD COLUMN IF NOT EXISTS correction_note TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_logs_fingerprint ON public.logs(run_id, fingerprint);

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_hitl BOOLEAN DEFAULT false;

-- Statuses the engine writes
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('running','paused_hitl','paused_error','resumed','completed','aborted','failed','stopped'));

ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS logs_status_check;
ALTER TABLE public.logs ADD CONSTRAINT logs_status_check
  CHECK (status IN ('success','failed','paused_hitl','paused_error'));

-- A workflow can be deleted without deleting its history
ALTER TABLE public.runs ALTER COLUMN workflow_id DROP NOT NULL;
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_workflow_id_fkey;
ALTER TABLE public.runs ADD CONSTRAINT runs_workflow_id_fkey
  FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE SET NULL;

-- Security: the app uses only the server-side service-role key (which bypasses RLS).
-- With RLS on and no policies, the public anon key can read nothing, which matters because
-- api_keys and ai_providers hold provider keys.
ALTER TABLE public.workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_settings ENABLE ROW LEVEL SECURITY;
REVOKE EXECUTE ON FUNCTION public.get_today_spend() FROM PUBLIC, anon, authenticated;
