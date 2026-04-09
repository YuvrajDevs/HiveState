-- Migration: Run Pause & Resume System
-- Date: 2026-04-08

-- 1. Update runs.status enum (Drop & Re-create constraint for flexibility)
ALTER TABLE public.runs 
DROP CONSTRAINT IF EXISTS runs_status_check;

ALTER TABLE public.runs
ADD CONSTRAINT runs_status_check 
CHECK (status IN ('running', 'paused_hitl', 'paused_error', 'resumed', 'completed', 'aborted', 'failed'));

-- 2. Enhance logs for HITL and Debugging
ALTER TABLE public.logs
ADD COLUMN IF NOT EXISTS input_payload TEXT, -- Store the exact input sent to the node
ADD COLUMN IF NOT EXISTS correction_note TEXT; -- HITL feedback/rejection notes

-- 3. Update existing statuses to align with new system (optional, but good for consistency)
UPDATE public.runs SET status = 'failed' WHERE status = 'aborted'; -- Normalize

-- 4. Add is_hitl to agents (if we want to store it at the agent layer too)
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS is_hitl BOOLEAN DEFAULT false;
