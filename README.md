# HiveState

HiveState is a visual workflow runner for multi-agent LLM pipelines. You draw a graph of agents on a canvas, give each
one a model and a prompt, and run it. Independent branches run in parallel, a step can pause for human review, a daily
budget stops runaway spend, and every step is recorded with its input, output, tokens, cost and timing.

Live demo: [hive-state.vercel.app](https://hive-state.vercel.app)

## Features

**Build**
- Canvas editor (React Flow) with undo/redo, keyboard shortcuts (`?` lists them) and an unsaved-changes guard.
- Agents on Google Gemini, OpenAI or Anthropic Claude, chosen per step.
- `{{variables}}` in prompts, filled in per run.
- Human review steps, or "review before running" on any agent.
- Workflow versions: every save that changes the graph is a version; restore any of them. Duplicate a workflow.
- Six templates to start from.

**Run**
- Runs are queued in Postgres and executed in the background, so closing the tab does not stop them.
- Cost estimate before you run, checked against today's budget.
- Per-step retries with exponential backoff, per-step timeouts, and a fallback model.
- Step output streams into the run page while the model is writing.
- Circuit breaker after repeated failures; daily spend limit that pauses runs instead of overspending.

**Inspect**
- Run history with status, workflow, time-range and text filters (kept in the URL).
- Run detail: timeline, search within steps, inputs, outputs, prompts, model, attempts, tokens and cost per step.
- Re-run a whole run, or re-run from one step: earlier results are reused, so only the changed part costs money.
- Retry a failed step with an edited input; approve or reject review steps with a note.
- Read-only share links for a run, revocable at any time.
- Trace search across every step of every run.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Canvas | @xyflow/react (React Flow 12) |
| Data | Supabase Postgres (free tier): tables, SQL functions, the run queue |
| Models | `@google/generative-ai`, `openai`, `@anthropic-ai/sdk` behind one model layer |
| Tests | Vitest; GitHub Actions with a Postgres 16 service |

No paid services are required. Redis, Kafka or a hosted queue are not needed: the queue is a Postgres table.

## Getting started

Requirements: Node.js 20+, a Supabase project (free tier), and an API key for at least one model provider. Without a
key you can still try everything with `HIVESTATE_MOCK_LLM=1`, which routes every model to an offline mock.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Configure the environment.

   ```bash
   cp .env.example .env.local
   ```

   Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and one of `GEMINI_API_KEY`, `OPENAI_API_KEY` or
   `ANTHROPIC_API_KEY`. Keys can also be added later under Settings. `.env.example` documents the optional settings.

3. Create the schema. Apply the files in `supabase/migrations/` in order (Supabase CLI: `supabase db push`, or paste
   them into the SQL editor). On an empty database, `scripts/db-replay.sh` shows which early files need special
   handling; it is what CI runs.

4. Load the demo data (optional): four workflows and 40 runs over the last two weeks. Re-running it refreshes them.

   ```bash
   DATABASE_URL="postgresql://..." npm run seed:demo
   ```

5. Start the app.

   ```bash
   npm run dev
   ```

### How runs are executed

`POST /api/run-workflow` only validates the request, creates the run and queues it. The queue is drained:

- by default, in the same serverless function after the response is sent (`after()`), which works on Vercel's free tier;
- by a dedicated worker if you self-host (`npm run worker`, or `docker compose up` for the app plus two workers; set
  `HIVESTATE_INLINE_DRAIN=0` on the web app);
- by `GET /api/jobs/drain` with `Authorization: Bearer $CRON_SECRET`, which the included scheduled GitHub Action calls
  every 15 minutes once `HIVESTATE_URL` (repository variable) and `CRON_SECRET` (secret) are set. This picks up runs
  whose worker was cut off.

Jobs are claimed with `FOR UPDATE SKIP LOCKED` and held with a lease, so any combination of these is safe.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit, engine and API route tests (no network or database needed) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm run worker` | Long-running queue worker |
| `npm run seed:demo` | Load or refresh the demo data (`DATABASE_URL` required) |
| `npm run db:replay` | Replay all migrations and the seed against `DATABASE_URL` and check the result |

## Project layout

```
app/                 pages, route handlers (app/api) and server actions (app/actions)
components/          UI: canvas, run form, run detail, history, shared states
lib/engine/          engine, graph utilities, templates, retry, cost estimate, re-run
lib/models/          model catalogue and prices, model hub, provider adapters
lib/queue/           Postgres job queue, worker loop, dispatch
lib/store/           RunStore interface with Supabase and in-memory implementations
supabase/migrations/ schema history; supabase/seed.sql demo data
tests/               Vitest suites
docs/ARCHITECTURE.md design, data model, run lifecycle, failure handling, scaling limits
```

## Security notes

- The app is single-tenant: there are no user accounts. Deploy it privately, or as a public demo with `DEMO_MODE=1`.
- The Supabase service-role key and provider keys stay on the server. Every table has row-level security enabled with
  no policies, so the public anon key can read nothing.
- Share links use random 192-bit tokens and can be revoked; shared pages are excluded from search engines.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design, the data model, failure handling, scaling limits and
the trade-offs behind them.
