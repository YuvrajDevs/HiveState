import type { JobKind, JobQueue, RunJob } from "./types";

/** In-memory JobQueue with the same semantics as the Postgres one. Used in tests. */
export class MemoryQueue implements JobQueue {
  jobs: RunJob[] = [];
  private seq = 0;
  now: () => number = () => Date.now();

  async enqueue(runId: string, kind: JobKind) {
    if (this.jobs.some((j) => j.run_id === runId && (j.status === "queued" || j.status === "running"))) return null;
    const job: RunJob = {
      id: ++this.seq, run_id: runId, kind, status: "queued", attempts: 0, max_attempts: 3,
      run_after: new Date(this.now()).toISOString(), locked_at: null, locked_by: null, last_error: null,
    };
    this.jobs.push(job);
    return { ...job };
  }

  async claim(workerId: string, leaseSeconds: number) {
    const now = this.now();
    const job = this.jobs.find(
      (j) =>
        (j.status === "queued" && Date.parse(j.run_after) <= now) ||
        (j.status === "running" && j.locked_at !== null && Date.parse(j.locked_at) < now - leaseSeconds * 1000),
    );
    if (!job) return null;
    Object.assign(job, { status: "running", locked_at: new Date(now).toISOString(), locked_by: workerId, attempts: job.attempts + 1 });
    return { ...job };
  }

  async complete(id: number, note?: string | null) {
    const job = this.jobs.find((j) => j.id === id);
    if (job) Object.assign(job, { status: "done", last_error: note ?? null, locked_at: null });
  }

  async fail(id: number, error: string, retryInSeconds: number) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return "dead" as const;
    const dead = job.attempts >= job.max_attempts;
    Object.assign(job, {
      status: dead ? "dead" : "queued",
      last_error: error,
      locked_at: null,
      locked_by: null,
      run_after: new Date(this.now() + retryInSeconds * 1000).toISOString(),
    });
    return dead ? ("dead" as const) : ("retry" as const);
  }
}
