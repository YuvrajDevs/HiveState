-- 1. Create the Demo Workflows
-- Workflow 1: Security Audit
INSERT INTO public.workflows (id, name, canvas_json)
VALUES (
  'd0000000-0000-0000-0000-000000000001', 
  'Automated Security Audit',
  '{
    "nodes": [
      { "id": "sec_1", "type": "AgentNode", "data": { "label": "Vulnerability Scanner", "systemPrompt": "Analyze the provided codebase for common vulnerabilities.", "model": "gemini-1.5-flash" } },
      { "id": "sec_2", "type": "AgentNode", "data": { "label": "API Security Expert", "systemPrompt": "Focus on API-related risks such as BOLA.", "model": "gemini-1.5-flash" } },
      { "id": "sec_4", "type": "AgentNode", "data": { "label": "Remediation Planner", "systemPrompt": "Consolidate into a prioritized remediation plan.", "model": "gemini-1.5-pro" } }
    ],
    "edges": [
      { "id": "e1-2", "source": "sec_1", "target": "sec_2" },
      { "id": "e2-4", "source": "sec_2", "target": "sec_4" }
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET canvas_json = EXCLUDED.canvas_json, name = EXCLUDED.name;

-- Workflow 2: Market Intelligence
INSERT INTO public.workflows (id, name, canvas_json)
VALUES (
  'd0000000-0000-0000-0000-000000000002', 
  'Market Intelligence Pipeline',
  '{
    "nodes": [
      { "id": "mark_1", "type": "AgentNode", "data": { "label": "Social Trend Scraper", "systemPrompt": "Analyze social media trends for a specific keyword.", "model": "gemini-1.5-flash" } },
      { "id": "mark_2", "type": "HITLNode", "data": { "label": "Strategic Review", "instructions": "Review trends and approve for sentiment analysis." } },
      { "id": "mark_3", "type": "AgentNode", "data": { "label": "Sentiment Specialist", "systemPrompt": "Classify trend sentiment (Bullish/Bearish/Neutral).", "model": "gemini-1.5-flash" } }
    ],
    "edges": [
      { "id": "me1-2", "source": "mark_1", "target": "mark_2" },
      { "id": "me2-3", "source": "mark_2", "target": "mark_3" }
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET canvas_json = EXCLUDED.canvas_json, name = EXCLUDED.name;

-- 2. Create Historical Runs
-- Run 1: Completed Security Audit
INSERT INTO public.runs (id, workflow_id, status, input_prompt, total_cost, total_tokens, total_duration_ms, started_at, completed_at)
VALUES (
  'r0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'completed',
  'Audit the HiveState core authentication module (v1.0.0-beta).',
  0.03042,
  4521,
  12480,
  NOW() - INTERVAL '4 hours',
  NOW() - INTERVAL '3 hours 58 minutes'
) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total_cost = EXCLUDED.total_cost, total_tokens = EXCLUDED.total_tokens;

-- Run 2: Paused HITL
INSERT INTO public.runs (id, workflow_id, status, pause_reason, paused_node_id, input_prompt, total_cost, total_tokens, total_duration_ms, started_at)
VALUES (
  'r0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000002',
  'paused_hitl',
  'hitl',
  'mark_2',
  'Analyze the NVIDIA stock sentiment following GTC announcement.',
  0.00845,
  1243,
  4200,
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, pause_reason = EXCLUDED.pause_reason;

-- Run 3: Circuit Breaker Triggered
INSERT INTO public.runs (id, workflow_id, status, pause_reason, circuit_breaker_triggered, consecutive_failures_count, input_prompt, total_cost, total_tokens, total_duration_ms, started_at)
VALUES (
  'r0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000001',
  'paused_error',
  'circuit_breaker',
  true,
  3,
  'Experimental scan on unstable cluster 09-X.',
  0.01520,
  2560,
  8100,
  NOW() - INTERVAL '1 hour'
) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, circuit_breaker_triggered = EXCLUDED.circuit_breaker_triggered;

-- 3. Create Logs for Seeded Runs
-- Logs for Run 1
DELETE FROM public.logs WHERE run_id = 'r0000000-0000-0000-0000-000000000001';
INSERT INTO public.logs (run_id, node_id, node_name, status, input, output, prompt_tokens, completion_tokens, total_tokens, step_cost, duration_ms)
VALUES 
('r0000000-0000-0000-0000-000000000001', 'sec_1', 'Vulnerability Scanner', 'success', 'Audit input', 'Found 3 minor risks in auth config.', 1242, 461, 1703, 0.013125, 3200),
('r0000000-0000-0000-0000-000000000001', 'sec_2', 'API Security Expert', 'success', 'Found 3 minor risks', 'Confirmed API endpoint risk /api/v1/auth.', 1683, 592, 2275, 0.017295, 4100);

-- Logs for Run 2 (HITL Pause)
DELETE FROM public.logs WHERE run_id = 'r0000000-0000-0000-0000-000000000002';
INSERT INTO public.logs (run_id, node_id, node_name, status, input, output, prompt_tokens, completion_tokens, total_tokens, step_cost, duration_ms)
VALUES 
('r0000000-0000-0000-0000-000000000002', 'mark_1', 'Social Trend Scraper', 'success', 'NVIDIA input', 'Trending: #GTC24, #Blackwell, #NVDA.', 842, 345, 1187, 0.009385, 4200),
('r0000000-0000-0000-0000-000000000002', 'mark_2', 'Strategic Review', 'paused_hitl', 'Trending results', NULL, 0, 0, 0, 0, 0);

-- Logs for Run 3 (CB)
DELETE FROM public.logs WHERE run_id = 'r0000000-0000-0000-0000-000000000003';
INSERT INTO public.logs (run_id, node_id, node_name, status, input, error, error_code, duration_ms)
VALUES 
('r0000000-0000-0000-0000-000000000003', 'sec_1', 'Vulnerability Scanner', 'failed', 'Unstable input', 'Upstream timeout', 'TIMEOUT_504', 2100);
