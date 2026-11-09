/**
 * Long-running queue worker for self-hosting (`npm run worker`, or the `worker` service in docker-compose).
 * Polls run_jobs with FOR UPDATE SKIP LOCKED, so several workers can run side by side.
 * With a dedicated worker, set HIVESTATE_INLINE_DRAIN=0 on the web app so requests only enqueue.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  // Imported after env is loaded: these modules read env at import time.
  const { drainQueue } = await import("../lib/queue/worker");
  const { SupabaseQueue } = await import("../lib/queue/supabase");
  const { getStore } = await import("../lib/store/supabase");
  const { runWorkflow, resumeWorkflow } = await import("../lib/engine/runner");

  const workerId = `worker-${process.pid}`;
  const idleMs = Number(process.env.WORKER_POLL_MS) || 2000;
  const deps = { queue: new SupabaseQueue(), engine: { runWorkflow, resumeWorkflow }, store: getStore() };
  let stopping = false;
  const stop = () => {
    console.log(`[${workerId}] finishing current job, then exiting`);
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`[${workerId}] polling every ${idleMs} ms`);
  while (!stopping) {
    try {
      const { processed } = await drainQueue(deps, { workerId, maxJobs: 1 });
      if (processed === 0) await new Promise((r) => setTimeout(r, idleMs));
    } catch (err) {
      console.error(`[${workerId}] poll failed:`, (err as Error).message);
      await new Promise((r) => setTimeout(r, idleMs * 5));
    }
  }
}

main();
