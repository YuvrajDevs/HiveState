import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { JobKind, JobQueue, RunJob } from "./types";

/** JobQueue over the `run_jobs` table. Claiming and failing are SQL functions so each is one atomic statement. */
export class SupabaseQueue implements JobQueue {
  async enqueue(runId: string, kind: JobKind) {
    const { data, error } = await supabaseAdmin.rpc("enqueue_run_job", { p_run_id: runId, p_kind: kind });
    if (error) throw new Error(`Could not queue the run: ${error.message}`);
    return ((Array.isArray(data) ? data[0] : data) as RunJob) ?? null;
  }

  async claim(workerId: string, leaseSeconds: number) {
    const { data, error } = await supabaseAdmin.rpc("claim_run_job", { p_worker: workerId, p_lease_seconds: leaseSeconds });
    if (error) throw new Error(`Could not claim a job: ${error.message}`);
    return ((Array.isArray(data) ? data[0] : data) as RunJob) ?? null;
  }

  async complete(id: number, note?: string | null) {
    const { error } = await supabaseAdmin
      .from("run_jobs")
      .update({ status: "done", last_error: note ?? null, locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`Could not complete job ${id}: ${error.message}`);
  }

  async fail(id: number, err: string, retryInSeconds: number) {
    const { data, error } = await supabaseAdmin.rpc("fail_run_job", { p_id: id, p_error: err, p_retry_in_seconds: retryInSeconds });
    if (error) throw new Error(`Could not record job failure: ${error.message}`);
    return data === "dead" ? "dead" : "retry";
  }
}

let queue: JobQueue | null = null;
export function getQueue(): JobQueue {
  queue ??= new SupabaseQueue();
  return queue;
}
