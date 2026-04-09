-- Migration: Add paused_node_id to runs
-- Date: 2026-04-08

ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS paused_node_id UUID REFERENCES public.agents(id);

COMMENT ON COLUMN public.runs.paused_node_id IS 'ID of the node where execution is currently paused (HITL or Error)';
