-- Phase 4: Workflow Execution & Access Refactor
-- 1. Updates to workflows for presets
ALTER TABLE public.workflows 
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- 2. Updates to logs for canvas-based execution
ALTER TABLE public.logs 
ALTER COLUMN agent_id DROP NOT NULL;

ALTER TABLE public.logs
ADD COLUMN IF NOT EXISTS node_id TEXT,
ADD COLUMN IF NOT EXISTS node_name TEXT;

-- 3. Seed Basic Presets (Blog Post, Code Review)
INSERT INTO public.workflows (name, is_template)
VALUES 
  ('Write Blog Post', true),
  ('Code Reviewer', true),
  ('Article Summarizer', true)
ON CONFLICT DO NOTHING;

-- Note: canvas_json for these templates will be populated via UI or a separate script
-- if we want them ready-to-use immediately.
