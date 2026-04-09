-- Phase 10: Templates & Instantiation Protocol
-- Author: Antigravity

-- 1. Add Template Columns to Workflows
ALTER TABLE public.workflows 
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS template_description TEXT;

-- 2. Cleanup Low-Quality/Test Workflows
-- We keep runs and logs (they will just point to non-existent workflows if those workflows are deleted)
-- To avoid foreign key issues, we'll null the workflow_id in runs before deleting.
-- Actually, the user said "Replace all existing workflows", so we'll delete them.
-- The foreign key is ON DELETE CASCADE in most of our schema, so runs/logs MIGHT be deleted too if we aren't careful.
-- Let's check the FK on `runs`. In 20260407174500_full_schema.sql it is ON DELETE CASCADE.
-- User said: "DO NOT delete: runs/tasks, logs".
-- So I should NOT delete workflows that have existing runs if I want to keep those runs.
-- OR I should change the FK to SET NULL.

-- For safety and following instructions strictly, I'll only delete workflows that have NO runs.
-- Or I'll set the FK to ON DELETE SET NULL for legacy runs.

ALTER TABLE public.runs 
DROP CONSTRAINT IF EXISTS runs_workflow_id_fkey,
ADD CONSTRAINT runs_workflow_id_fkey 
FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE SET NULL;

-- Now delete all workflows
DELETE FROM public.workflows WHERE is_template = false;

-- 3. Seed 6 High-Quality Templates

-- Template 1: Research → Summary
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Research Cluster', 
  true, 
  'Deep Research & Synthesis', 
  'Gather raw data, synthesize into a report, and simplify for broad communication.',
  '{
    "nodes": [
      { "id": "t1_n1", "type": "agent", "data": { "label": "Researcher", "systemPrompt": "You are a detailed research agent. Given a topic or input, your goal is to find facts, data points, and technical details. Scrape, search, and analyze deeply.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t1_n2", "type": "agent", "data": { "label": "Synthesizer", "systemPrompt": "You are a report synthesizer. Take the raw research data and structure it into a cohesive analysis with headings and key insights.", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t1_n3", "type": "agent", "data": { "label": "Simplifier", "systemPrompt": "You are a communication specialist. Take the complex report and rewrite it for a non-technical executive audience.", "model": "gemini-1.5-flash" }, "position": { "x": 600, "y": 0 } }
    ],
    "edges": [
      { "id": "t1_e1", "source": "t1_n1", "target": "t1_n2" },
      { "id": "t1_e2", "source": "t1_n2", "target": "t1_n3" }
    ]
  }'::jsonb
);

-- Template 2: Long-Form Report Generator
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Report Factory', 
  true, 
  'Long-Form Report Generator', 
  'Professional document creation pipeline from outline to final formatting.',
  '{
    "nodes": [
      { "id": "t2_n1", "type": "agent", "data": { "label": "Outline Planner", "systemPrompt": "Create a detailed multi-section outline for a professional report based on the user input.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t2_n2", "type": "agent", "data": { "label": "Section Ghostwriter", "systemPrompt": "Expand the provided outline into full-length technical sections. Focus on depth and accuracy.", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t2_n3", "type": "agent", "data": { "label": "Editorial Lead", "systemPrompt": "Review the full report for flow, consistency, and professional tone. Correct any errors.", "model": "gemini-1.5-pro" }, "position": { "x": 600, "y": 0 } },
      { "id": "t2_n4", "type": "agent", "data": { "label": "Document Formatter", "systemPrompt": "Clean up the final output. Apply markdown headings, bold important terms, and ensure a premium structure.", "model": "gemini-1.5-flash" }, "position": { "x": 900, "y": 0 } }
    ],
    "edges": [
      { "id": "t2_e1", "source": "t2_n1", "target": "t2_n2" },
      { "id": "t2_e2", "source": "t2_n2", "target": "t2_n3" },
      { "id": "t2_e3", "source": "t2_n3", "target": "t2_n4" }
    ]
  }'::jsonb
);

-- Template 3: Content Creation Pipeline
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Content Engine', 
  true, 
  'Social/Blog Content Pipeline', 
  'End-to-end content production from raw idea to optimized final copy.',
  '{
    "nodes": [
      { "id": "t3_n1", "type": "agent", "data": { "label": "Idea Generator", "systemPrompt": "Take a core concept and generate 10 viral or engaging angles for content.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t3_n2", "type": "agent", "data": { "label": "First Draft", "systemPrompt": "Write a high-quality article or post based on the chosen angle.", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t3_n3", "type": "agent", "data": { "label": "Style Optimizer", "systemPrompt": "Refine the tone to be more engaging, punchy, and persuasive.", "model": "gemini-1.5-flash" }, "position": { "x": 600, "y": 0 } }
    ],
    "edges": [
      { "id": "t3_e1", "source": "t3_n1", "target": "t3_n2" },
      { "id": "t3_e2", "source": "t3_n2", "target": "t3_n3" }
    ]
  }'::jsonb
);

-- Template 4: Code Review Assistant
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Code Auditor', 
  true, 
  'Code Review & Security Audit', 
  'Analyze code for bugs, security risks, and performance smells.',
  '{
    "nodes": [
      { "id": "t4_n1", "type": "agent", "data": { "label": "Code Analyzer", "systemPrompt": "Analyze the provided code for architectural issues and logic bugs.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t4_n2", "type": "agent", "data": { "label": "Issue Hunter", "systemPrompt": "Focus exclusively on potential security vulnerabilities (XSS, Injection, secrets).", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t4_n3", "type": "agent", "data": { "label": "PR Assistant", "systemPrompt": "Generate a summary of changes and suggested refactors in a GitHub PR comment style.", "model": "gemini-1.5-flash" }, "position": { "x": 600, "y": 0 } }
    ],
    "edges": [
      { "id": "t4_e1", "source": "t4_n1", "target": "t4_n2" },
      { "id": "t4_e2", "source": "t4_n2", "target": "t4_n3" }
    ]
  }'::jsonb
);

-- Template 5: Document Summarization
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Doc Scraper', 
  true, 
  'Document Insight Extractor', 
  'Extract key facts, summarize contents, and list actionable takeaways.',
  '{
    "nodes": [
      { "id": "t5_n1", "type": "agent", "data": { "label": "Fact Extractor", "systemPrompt": "Extract every unique fact, date, and name from the document.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t5_n2", "type": "agent", "data": { "label": "Summary Agent", "systemPrompt": "Condense the document into a 3-paragraph executive summary.", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t5_n3", "type": "agent", "data": { "label": "Action Items", "systemPrompt": "List 5-10 actionable takeaways or next steps based on the document.", "model": "gemini-1.5-flash" }, "position": { "x": 600, "y": 0 } }
    ],
    "edges": [
      { "id": "t5_e1", "source": "t5_n1", "target": "t5_n2" },
      { "id": "t5_e2", "source": "t5_n2", "target": "t5_n3" }
    ]
  }'::jsonb
);

-- Template 6: Marketing Copy Generator
INSERT INTO public.workflows (name, is_template, template_name, template_description, canvas_json)
VALUES (
  'Marketing Studio', 
  true, 
  'High-Conversion Ad Copy', 
  'Analyze target audience and generate multi-platform ad copy with hooks.',
  '{
    "nodes": [
      { "id": "t6_n1", "type": "agent", "data": { "label": "Audience Profiler", "systemPrompt": "Analyze the product/service and define the ideal customer profile, pain points, and desires.", "model": "gemini-2.0-flash" }, "position": { "x": 0, "y": 0 } },
      { "id": "t6_n2", "type": "agent", "data": { "label": "Copywriter", "systemPrompt": "Write 5 variations of high-converting ad copy (Facebook, Google, LinkedIn).", "model": "gemini-2.0-flash" }, "position": { "x": 300, "y": 0 } },
      { "id": "t6_n3", "type": "agent", "data": { "label": "Hook Optimizer", "systemPrompt": "Generate 10 extreme-attention hooks for the copy.", "model": "gemini-1.5-flash" }, "position": { "x": 600, "y": 0 } }
    ],
    "edges": [
      { "id": "t6_e1", "source": "t6_n1", "target": "t6_n2" },
      { "id": "t6_e2", "source": "t6_n2", "target": "t6_n3" }
    ]
  }'::jsonb
);
