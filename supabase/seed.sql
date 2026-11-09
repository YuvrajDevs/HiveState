-- Demo data for HiveState: four realistic workflows and ~40 runs over the last two weeks.
-- Idempotent: re-running it replaces the demo runs (timestamps are relative to now(), so re-seeding
-- also "refreshes" the demo). Everything it creates is flagged is_demo = true.
--   Hosted:  psql "$DATABASE_URL" -f supabase/seed.sql      (npm run seed:demo)
--   Local:   supabase db reset  (the Supabase CLI runs this file automatically)

BEGIN;

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------
INSERT INTO public.workflows (id, name, is_template, is_demo, canvas_json) VALUES
('0d000000-0000-4000-8000-000000000001', 'Competitor Brief', false, true, $json${
  "nodes": [
    {"id":"cb_research","type":"AgentNode","position":{"x":300,"y":0},"data":{"label":"Researcher","model":"gemini-2.5-flash","retries":2,"timeoutMs":60000,"systemPrompt":"You research {{company}}. From the notes provided, list the facts that matter to a competitor: products, pricing, customers, funding, hiring signals. Cite the line each fact came from."}},
    {"id":"cb_market","type":"AgentNode","position":{"x":80,"y":220},"data":{"label":"Market Analyst","model":"gemini-2.5-flash-lite","systemPrompt":"Assess {{company}}'s market position: segment, growth, threats and the moat. Be specific and quantitative where the research allows."}},
    {"id":"cb_product","type":"AgentNode","position":{"x":520,"y":220},"data":{"label":"Product Analyst","model":"claude-haiku-5-5","systemPrompt":"Compare {{company}}'s product against ours ({{our_product}}). Output a feature gap table and three things we should copy or counter."}},
    {"id":"cb_writer","type":"AgentNode","position":{"x":300,"y":440},"data":{"label":"Brief Writer","model":"claude-sonnet-5-5","systemPrompt":"Write a one-page competitor brief for the leadership team: summary, threats, opportunities, recommended actions. Plain language, no filler."}}
  ],
  "edges": [
    {"id":"cb_e1","source":"cb_research","target":"cb_market"},
    {"id":"cb_e2","source":"cb_research","target":"cb_product"},
    {"id":"cb_e3","source":"cb_market","target":"cb_writer"},
    {"id":"cb_e4","source":"cb_product","target":"cb_writer"}
  ]}$json$::jsonb),
('0d000000-0000-4000-8000-000000000002', 'Support Ticket Triage', false, true, $json${
  "nodes": [
    {"id":"st_classify","type":"AgentNode","position":{"x":200,"y":0},"data":{"label":"Classifier","model":"gemini-2.5-flash-lite","retries":3,"timeoutMs":20000,"systemPrompt":"Classify the ticket: category (billing, bug, how-to, account, feature request), severity (P1-P4), sentiment, and whether it mentions churn. Reply as JSON."}},
    {"id":"st_draft","type":"AgentNode","position":{"x":200,"y":200},"data":{"label":"Reply Drafter","model":"gpt-5-mini","systemPrompt":"Draft a reply to the customer in the voice of {{team_name}} support. Acknowledge the issue, give the fix or next step, set expectations. Under 150 words."}},
    {"id":"st_review","type":"HITLNode","position":{"x":200,"y":400},"data":{"label":"Agent Review","instructions":"Check tone and the promised timeline before the reply goes out. Add a note to change anything."}},
    {"id":"st_polish","type":"AgentNode","position":{"x":200,"y":600},"data":{"label":"Final Polish","model":"gemini-2.5-flash-lite","systemPrompt":"Apply any reviewer feedback to the draft and return the final reply only."}}
  ],
  "edges": [
    {"id":"st_e1","source":"st_classify","target":"st_draft"},
    {"id":"st_e2","source":"st_draft","target":"st_review"},
    {"id":"st_e3","source":"st_review","target":"st_polish"}
  ]}$json$::jsonb),
('0d000000-0000-4000-8000-000000000003', 'Security Code Review', false, true, $json${
  "nodes": [
    {"id":"sc_scan","type":"AgentNode","position":{"x":200,"y":0},"data":{"label":"Vulnerability Scanner","model":"gemini-2.5-flash","systemPrompt":"Review the code for injection, XSS, SSRF, hard-coded secrets and unsafe deserialisation. List each finding with file, line and severity."}},
    {"id":"sc_api","type":"AgentNode","position":{"x":200,"y":200},"data":{"label":"API Security Reviewer","model":"claude-sonnet-5-5","retries":2,"systemPrompt":"Focus on API risks: broken object-level authorisation, missing rate limits, weak tokens, verbose errors. Confirm or reject each earlier finding."}},
    {"id":"sc_plan","type":"AgentNode","position":{"x":200,"y":400},"data":{"label":"Remediation Planner","model":"gpt-4.1-mini","systemPrompt":"Turn the confirmed findings into a prioritised fix plan with owners, effort and a test for each fix."}}
  ],
  "edges": [
    {"id":"sc_e1","source":"sc_scan","target":"sc_api"},
    {"id":"sc_e2","source":"sc_api","target":"sc_plan"}
  ]}$json$::jsonb),
('0d000000-0000-4000-8000-000000000004', 'Release Notes Writer', false, true, $json${
  "nodes": [
    {"id":"rn_group","type":"AgentNode","position":{"x":200,"y":0},"data":{"label":"Change Grouper","model":"gemini-2.5-flash-lite","systemPrompt":"Group the merged pull requests into Features, Fixes, Performance and Internal. Drop anything purely internal."}},
    {"id":"rn_write","type":"AgentNode","position":{"x":200,"y":200},"data":{"label":"Notes Writer","model":"gpt-5-mini","systemPrompt":"Write customer-facing release notes for version {{version}}. Lead with the benefit, one line per change, link issue numbers."}}
  ],
  "edges": [
    {"id":"rn_e1","source":"rn_group","target":"rn_write"}
  ]}$json$::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, canvas_json = EXCLUDED.canvas_json, is_demo = true;

-- Version 1 for each demo workflow (no-op when the canvas is unchanged).
DO $$ BEGIN PERFORM public.save_workflow_version(id, canvas_json, 'Demo workflow') FROM public.workflows WHERE is_demo; END $$;

-- ---------------------------------------------------------------------------
-- Runs and steps
-- ---------------------------------------------------------------------------
DELETE FROM public.runs WHERE is_demo; -- cascades to logs and run_jobs

CREATE TEMP TABLE demo_prices (model TEXT PRIMARY KEY, usd_in NUMERIC, usd_out NUMERIC) ON COMMIT DROP;
INSERT INTO demo_prices VALUES
  ('gemini-2.5-flash-lite', 0.10, 0.40), ('gemini-2.5-flash', 0.30, 2.50), ('gpt-5-mini', 0.25, 2.00),
  ('gpt-4.1-mini', 0.40, 1.60), ('claude-haiku-5-5', 0.10, 0.50), ('claude-sonnet-5-5', 2.00, 10.00);

-- Canned step results: one realistic output per step, reused across runs with varying token counts.
CREATE TEMP TABLE demo_steps (wf INT, ord INT, node_id TEXT, node_name TEXT, model TEXT, prompt_tokens INT, completion_tokens INT, output TEXT) ON COMMIT DROP;
INSERT INTO demo_steps VALUES
(1, 1, 'cb_research', 'Researcher', 'gemini-2.5-flash', 1850, 640, E'Key facts\n- Launched usage-based pricing in Q3 (pricing page, line 4).\n- 3 enterprise logos added: two logistics firms and a regional bank (case studies, lines 12-18).\n- Series B of $42M led by a growth fund (press release, line 2).\n- 11 open roles, 7 in sales, none in ML research (careers page).\n- Mobile app still in beta (changelog, line 31).'),
(1, 2, 'cb_market', 'Market Analyst', 'gemini-2.5-flash-lite', 760, 520, E'Position: mid-market workflow automation, moving up-market.\nGrowth: hiring is sales-heavy, so expect aggressive enterprise outreach in the next two quarters.\nThreat: usage-based pricing undercuts our seat pricing for teams under 40 people.\nMoat: weak. Integrations are broad but shallow; no proprietary data.'),
(1, 3, 'cb_product', 'Product Analyst', 'claude-haiku-5-5', 790, 610, E'| Capability | Them | Us |\n|---|---|---|\n| Visual builder | Yes | Yes |\n| Human review steps | No | Yes |\n| Per-step cost tracking | No | Yes |\n| Mobile app | Beta | No |\n\nCopy: usage-based tier for small teams.\nCounter: lead demos with review steps and cost controls.\nWatch: their mobile app.'),
(1, 4, 'cb_writer', 'Brief Writer', 'claude-sonnet-5-5', 1420, 830, E'Competitor brief\n\nSummary: a well-funded rival is moving into our enterprise segment with cheaper usage-based pricing.\n\nThreats: price-led wins in teams under 40 seats; a sales push over the next two quarters.\n\nOpportunities: they have no human-in-the-loop review or cost governance, which regulated buyers ask for.\n\nActions: 1) ship a usage-based starter tier, 2) put review and budget controls at the front of enterprise demos, 3) brief sales on the three new logos.'),
(2, 1, 'st_classify', 'Classifier', 'gemini-2.5-flash-lite', 420, 90, '{"category":"billing","severity":"P2","sentiment":"frustrated","churn_risk":true}'),
(2, 2, 'st_draft', 'Reply Drafter', 'gpt-5-mini', 610, 210, E'Hi Priya,\n\nThanks for flagging the double charge on your March invoice, and sorry for the hassle. I have confirmed the duplicate payment and started a refund of the second charge; it will reach your card in 3-5 business days.\n\nI have also added a note to your account so this cannot recur on the next cycle. Reply here if anything looks off.\n\nBest,\nAcme Support'),
(2, 3, 'st_review', 'Agent Review', NULL, 0, 0, NULL),
(2, 4, 'st_polish', 'Final Polish', 'gemini-2.5-flash-lite', 380, 190, E'Hi Priya,\n\nThanks for flagging the double charge on your March invoice, and sorry for the trouble. The duplicate payment is confirmed and the refund is on its way: expect it on your card within 3-5 business days.\n\nWe have also fixed the billing setting that caused it. Reply here if anything looks off.\n\nBest,\nAcme Support'),
(3, 1, 'sc_scan', 'Vulnerability Scanner', 'gemini-2.5-flash', 2600, 540, E'Findings\n1. HIGH  api/users.ts:42  SQL built with string concatenation from req.query.id\n2. HIGH  config/auth.ts:8  JWT secret hard-coded\n3. MED   api/upload.ts:19  fetch() of a user-supplied URL (SSRF)\n4. LOW   middleware/error.ts:11  stack traces returned to clients'),
(3, 2, 'sc_api', 'API Security Reviewer', 'claude-sonnet-5-5', 1210, 620, E'Confirmed: 1, 2, 3, 4.\nAdded: 5. MED  GET /api/invoices/:id returns any invoice by id without an ownership check (BOLA).\nAdded: 6. MED  /api/login has no rate limit; credential stuffing is possible.\nRejected: none.'),
(3, 3, 'sc_plan', 'Remediation Planner', 'gpt-4.1-mini', 980, 560, E'Fix plan\nP0 (this sprint)\n- Parameterise the users query (backend, 1h). Test: id=1 OR 1=1 returns 400.\n- Move JWT secret to env and rotate (platform, 2h). Test: boot fails without the env var.\n- Ownership check on invoices (backend, 2h). Test: user A gets 404 for user B''s invoice.\nP1\n- Allow-list hosts for upload fetch (backend, 3h).\n- Rate-limit /api/login, 10/min per IP (platform, 2h).\nP2\n- Generic error responses in production (backend, 1h).'),
(4, 1, 'rn_group', 'Change Grouper', 'gemini-2.5-flash-lite', 1350, 300, E'Features: #412 bulk export, #418 SSO for Google Workspace\nFixes: #405 timezone shift in reports, #421 CSV import with BOM\nPerformance: #409 dashboard loads 2x faster'),
(4, 2, 'rn_write', 'Notes Writer', 'gpt-5-mini', 420, 260, E'What''s new\n- Export everything at once: bulk export for all reports (#412).\n- Sign in with Google Workspace SSO (#418).\n\nFixes\n- Report dates no longer shift across time zones (#405).\n- CSV files saved from Excel now import cleanly (#421).\n\nFaster\n- The dashboard loads about twice as fast (#409).');

CREATE TEMP TABLE demo_inputs (wf INT, k INT, input TEXT, vars JSONB) ON COMMIT DROP;
INSERT INTO demo_inputs VALUES
(1, 0, 'Notes from Northwind''s site, pricing page, careers page and last press release (pasted below)...', '{"company":"Northwind","our_product":"HiveState"}'),
(1, 1, 'Research dump on Fabrikam: G2 reviews, pricing screenshots transcribed, two LinkedIn posts from their CPO...', '{"company":"Fabrikam","our_product":"HiveState"}'),
(1, 2, 'Contoso public roadmap and changelog for the last 90 days...', '{"company":"Contoso","our_product":"HiveState"}'),
(2, 0, 'Subject: charged twice!! I was billed twice for March and nobody answered my last email. Considering cancelling. - Priya', '{"team_name":"Acme"}'),
(2, 1, 'Subject: export broken. The CSV export button spins forever on the Reports page since this morning.', '{"team_name":"Acme"}'),
(2, 2, 'Subject: how do I add a teammate? Can''t find the invite option on the free plan.', '{"team_name":"Acme"}'),
(3, 0, 'Diff for PR #233: user lookup endpoint, upload-from-URL feature, auth config refactor (full patch below)...', '{}'),
(3, 1, 'Review the billing service module before the SOC 2 audit (files: api/invoices.ts, api/users.ts, middleware/*)', '{}'),
(4, 0, 'Merged PRs since v2.7.0: #405 #409 #412 #418 #421 with titles and descriptions...', '{"version":"2.8.0"}'),
(4, 1, 'Merged PRs since v2.6.0 (34 PRs, list below)...', '{"version":"2.7.0"}');

-- 40 runs spread over 14 days. Outcome mix: mostly completed, a few failures, one waiting for review.
CREATE TEMP TABLE demo_runs ON COMMIT DROP AS
SELECT
  md5('hivestate-demo-run-' || g)::uuid AS id,
  g,
  wf,
  ('0d000000-0000-4000-8000-00000000000' || wf)::uuid AS workflow_id,
  now() - make_interval(hours => (g * 8 + (g % 5) * 3)) - make_interval(mins => (g * 17) % 60) AS started_at,
  CASE
    WHEN g = 1 AND wf = 2 THEN 'paused_hitl'
    WHEN g IN (7, 23) THEN 'paused_error'
    WHEN g IN (15, 31) THEN 'failed'
    ELSE 'completed'
  END AS status,
  1.0 + ((g * 37) % 40) / 100.0 AS jitter
FROM (SELECT g, CASE WHEN g % 10 < 4 THEN 1 WHEN g % 10 < 7 THEN 2 WHEN g % 10 < 9 THEN 3 ELSE 4 END AS wf
        FROM generate_series(1, 40) AS g) s;

-- Run 1 should be the "waiting for review" ticket, so make it the Support workflow.
UPDATE demo_runs SET wf = 2, workflow_id = '0d000000-0000-4000-8000-000000000002', status = 'paused_hitl' WHERE g = 1;

INSERT INTO public.runs (id, workflow_id, status, input_prompt, variables, started_at, updated_at, completed_at,
                         pause_reason, paused_node_id, error, workflow_version, is_demo, consecutive_failures_count, circuit_breaker_triggered)
SELECT r.id, r.workflow_id, r.status, i.input, i.vars, r.started_at, r.started_at + interval '40 seconds',
       CASE WHEN r.status IN ('completed','failed') THEN r.started_at + interval '40 seconds' END,
       CASE r.status WHEN 'paused_hitl' THEN 'hitl' WHEN 'paused_error' THEN CASE WHEN r.g = 23 THEN 'circuit_breaker' ELSE 'error' END END,
       CASE r.status WHEN 'paused_hitl' THEN 'st_review' WHEN 'paused_error' THEN (SELECT node_id FROM demo_steps s WHERE s.wf = r.wf AND s.ord = 2) END,
       CASE r.status
         WHEN 'paused_error' THEN '429 Too Many Requests: provider rate limit exceeded after 3 attempts'
         WHEN 'failed' THEN 'Stopped by user'
       END,
       1, true,
       CASE WHEN r.g = 23 THEN 3 ELSE 0 END,
       r.g = 23
  FROM demo_runs r
  JOIN demo_inputs i ON i.wf = r.wf AND i.k = r.g % (SELECT count(*) FROM demo_inputs x WHERE x.wf = r.wf);

-- Successful steps: every step for completed runs; steps before the failure/pause for the others.
INSERT INTO public.logs (run_id, node_id, node_name, input, output, status, system_prompt, model_used,
                         prompt_tokens, completion_tokens, total_tokens, step_cost, duration_ms, attempts, created_at, skip_reason)
SELECT r.id, s.node_id, s.node_name,
       COALESCE(prev.output, ru.input_prompt),
       CASE WHEN s.model IS NULL THEN COALESCE(prev.output, '') ELSE s.output END,
       'success',
       (SELECT n->'data'->>'systemPrompt' FROM jsonb_array_elements(w.canvas_json->'nodes') n WHERE n->>'id' = s.node_id),
       s.model,
       round(s.prompt_tokens * r.jitter), round(s.completion_tokens * r.jitter),
       round((s.prompt_tokens + s.completion_tokens) * r.jitter),
       COALESCE(round((s.prompt_tokens * r.jitter * p.usd_in + s.completion_tokens * r.jitter * p.usd_out) / 1e6 * 88, 6), 0),
       CASE WHEN s.model IS NULL THEN 0 ELSE round(1800 + s.completion_tokens * 9 * r.jitter) END,
       CASE WHEN (r.g + s.ord) % 9 = 0 THEN 2 ELSE 1 END,
       r.started_at + make_interval(secs => s.ord * 9),
       CASE WHEN s.model IS NULL THEN 'hitl_gate' END
  FROM demo_runs r
  JOIN public.runs ru ON ru.id = r.id
  JOIN public.workflows w ON w.id = r.workflow_id
  JOIN demo_steps s ON s.wf = r.wf
  LEFT JOIN demo_steps prev ON prev.wf = s.wf AND prev.ord = s.ord - 1
  LEFT JOIN demo_prices p ON p.model = s.model
 WHERE r.status = 'completed'
    OR (r.status = 'paused_hitl' AND s.ord < 3)
    OR (r.status IN ('paused_error','failed') AND s.ord < 2);

-- The review step the paused run is waiting on.
INSERT INTO public.logs (run_id, node_id, node_name, input, status, skip_reason, created_at)
SELECT r.id, 'st_review', 'Agent Review', (SELECT output FROM demo_steps WHERE wf = 2 AND ord = 2), 'paused_hitl', 'hitl_gate', r.started_at + interval '27 seconds'
  FROM demo_runs r WHERE r.status = 'paused_hitl';

-- The failed attempt for runs paused on an error.
INSERT INTO public.logs (run_id, node_id, node_name, input, status, error, error_code, model_used, duration_ms, attempts, created_at)
SELECT r.id, s.node_id, s.node_name, (SELECT output FROM demo_steps WHERE wf = r.wf AND ord = 1), 'failed',
       '429 Too Many Requests: provider rate limit exceeded', 'HTTP_429', s.model, 21400, 3, r.started_at + interval '18 seconds'
  FROM demo_runs r JOIN demo_steps s ON s.wf = r.wf AND s.ord = 2
 WHERE r.status = 'paused_error';

-- Run totals are derived from the steps, the same way the engine computes them.
UPDATE public.runs r SET
  total_cost = t.cost, total_tokens = t.tokens, total_duration_ms = t.duration
  FROM (SELECT run_id, SUM(step_cost) cost, SUM(total_tokens) tokens, SUM(duration_ms) duration
          FROM public.logs WHERE status IN ('success','failed') GROUP BY run_id) t
 WHERE r.id = t.run_id AND r.is_demo;

-- One completed run gets a share link, so the read-only view can be demoed.
UPDATE public.runs SET share_token = 'demo-competitor-brief'
 WHERE id = (SELECT id FROM demo_runs WHERE status = 'completed' AND wf = 1 ORDER BY g LIMIT 1);

COMMIT;
