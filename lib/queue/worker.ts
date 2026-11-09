import type { Engine } from "../engine/engine";
import type { RunStore } from "../store/types";
import { LEASE_SECONDS, type JobQueue, type RunJob } from "./types";

/**
 * Processes queued runs. Shared by the three ways work gets picked up:
 *  1. `after()` in the API route that queued the run (no extra infrastructure, works on Vercel),
 *  2. `npm run worker`, a long-lived poller for self-hosting or Docker,
 *  3. `/api/jobs/drain`, called by a scheduler to recover jobs whose worker died.
 */

export interface WorkerDeps {
  queue: JobQueue;
  engine: Pick<Engine, "runWorkflow" | "resumeWorkflow">;
  store: Pick<RunStore, "getRun" | "updateRun">;
  log?: Pick<Console, "log" | "warn" | "error">;
}

const TERMINAL = new Set(["completed", "failed", "stopped", "aborted", "paused_hitl", "paused_error"]);

export async function processJob(job: RunJob, deps: WorkerDeps): Promise<"done" | "retry" | "dead"> {
  const { queue, engine, store } = deps;
  const log = deps.log ?? console;
  try {
    const run = await store.getRun(job.run_id);
    if (!run) {
      await queue.complete(job.id, "run no longer exists");
      return "done";
    }
    if (run.status === "stopped") {
      await queue.complete(job.id, "run was stopped before it started");
      return "done";
    }
    if (job.kind === "resume") await engine.resumeWorkflow(job.run_id);
    else await engine.runWorkflow(run.workflow_id || "", run.input_prompt || "", run.id, { fresh: true });
    await queue.complete(job.id);
    return "done";
  } catch (err) {
    const message = (err as Error).message || "unknown error";
    // The engine records business failures (bad graph, budget) on the run itself: no point retrying those.
    const run = await store.getRun(job.run_id).catch(() => null);
    if (run && TERMINAL.has(run.status)) {
      await queue.complete(job.id, message);
      return "done";
    }
    const retryIn = Math.min(300, 15 * 2 ** (job.attempts - 1));
    const outcome = await queue.fail(job.id, message, retryIn);
    if (outcome === "dead") {
      log.error(`[worker] job ${job.id} gave up after ${job.attempts} attempts: ${message}`);
      await store.updateRun(job.run_id, { status: "failed", error: `Execution failed after ${job.attempts} attempts: ${message}` }).catch(() => undefined);
    } else {
      log.warn(`[worker] job ${job.id} failed (${message}); retrying in ${retryIn}s`);
    }
    return outcome;
  }
}

export interface DrainOptions {
  workerId: string;
  maxJobs?: number;
  /** Stop claiming new jobs after this many ms, so a serverless invocation finishes in time. */
  budgetMs?: number;
}

export async function drainQueue(deps: WorkerDeps, opts: DrainOptions) {
  const started = Date.now();
  const max = opts.maxJobs ?? 5;
  let processed = 0;
  while (processed < max && (!opts.budgetMs || Date.now() - started < opts.budgetMs)) {
    const job = await deps.queue.claim(opts.workerId, LEASE_SECONDS);
    if (!job) break;
    await processJob(job, deps);
    processed++;
  }
  return { processed };
}
