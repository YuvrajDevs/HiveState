import "server-only";
import crypto from "crypto";
import { after } from "next/server";
import { getQueue } from "./supabase";
import { drainQueue, type WorkerDeps } from "./worker";
import type { JobKind } from "./types";
import { getStore } from "@/lib/store/supabase";
import { runWorkflow, resumeWorkflow } from "@/lib/engine/runner";

export function workerDeps(): WorkerDeps {
  return { queue: getQueue(), engine: { runWorkflow, resumeWorkflow }, store: getStore() };
}

/**
 * Queues a run and, unless a dedicated worker is configured (HIVESTATE_INLINE_DRAIN=0), drains the queue
 * after the response is sent. `after()` keeps the serverless function alive until the work finishes
 * (up to the route's maxDuration); anything it cannot finish is reclaimed later via the lease.
 * Must be called while handling a request or server action.
 */
export async function dispatchRun(runId: string, kind: JobKind): Promise<{ mode: "queued" | "inline" }> {
  try {
    await getQueue().enqueue(runId, kind);
  } catch (err) {
    // The queue table is missing (migration not applied yet). Degrade to the old in-process execution.
    console.warn(`[dispatch] queue unavailable (${(err as Error).message}); running inline`);
    after(async () => {
      try {
        if (kind === "resume") await resumeWorkflow(runId);
        else {
          const run = await getStore().getRun(runId);
          if (run?.workflow_id) await runWorkflow(run.workflow_id, run.input_prompt || "", runId, { fresh: true });
        }
      } catch (e) {
        console.error(`[dispatch] inline execution of ${runId} failed:`, (e as Error).message);
      }
    });
    return { mode: "inline" };
  }

  if (process.env.HIVESTATE_INLINE_DRAIN !== "0") {
    after(() =>
      drainQueue(workerDeps(), { workerId: `after-${crypto.randomUUID().slice(0, 8)}`, maxJobs: 3, budgetMs: 240_000 }).catch((e) =>
        console.error("[dispatch] drain failed:", (e as Error).message),
      ),
    );
  }
  return { mode: "queued" };
}
