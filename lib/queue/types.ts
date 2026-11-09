export type JobKind = "run" | "resume";
export type JobStatus = "queued" | "running" | "done" | "dead";

export interface RunJob {
  id: number;
  run_id: string;
  kind: JobKind;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
}

/**
 * Durable work queue for run execution, backed by a Postgres table.
 *  - enqueue is idempotent per run: at most one queued/running job per run.
 *  - claim uses FOR UPDATE SKIP LOCKED, so any number of workers can poll without double-claiming.
 *  - a claimed job holds a lease; if its worker dies the lease expires and another worker reclaims it.
 */
export interface JobQueue {
  enqueue(runId: string, kind: JobKind): Promise<RunJob | null>;
  claim(workerId: string, leaseSeconds: number): Promise<RunJob | null>;
  complete(id: number, note?: string | null): Promise<void>;
  /** Schedules another attempt after `retryInSeconds`, or marks the job dead when attempts are used up. */
  fail(id: number, error: string, retryInSeconds: number): Promise<"retry" | "dead">;
}

export const LEASE_SECONDS = 330; // longer than the 300 s function limit, so a live job is never stolen
