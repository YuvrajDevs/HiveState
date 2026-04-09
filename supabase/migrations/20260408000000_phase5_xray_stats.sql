-- Phase 5: X-Ray Execution Metrics

-- 1. Add deep observability columns to logs
ALTER TABLE public.logs
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS step_cost NUMERIC DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_code TEXT,
ADD COLUMN IF NOT EXISTS system_prompt TEXT; -- to explicitly store what was requested

-- 2. Add accumulated totals to runs
ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER DEFAULT 0;
