-- HiveState Full Schema Migration (v1.0)
-- Consolidated for Gemini + Phase 2 UI
-- User: Run this in Supabase SQL Editor

-- 1. Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Agents
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Runs (Execution Sessions)
CREATE TABLE IF NOT EXISTS public.runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'failed', 'completed')),
    input_prompt TEXT,
    context_summary TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Logs (Agent Steps)
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    input TEXT,
    output TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. API Keys (Settings)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_agents_workflow_order ON public.agents(workflow_id, order_index);
CREATE INDEX IF NOT EXISTS idx_logs_run ON public.logs(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_workflow ON public.runs(workflow_id);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
