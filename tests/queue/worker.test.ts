import { describe, expect, it, vi } from "vitest";
import { MemoryQueue } from "@/lib/queue/memory";
import { drainQueue, processJob } from "@/lib/queue/worker";
import { agent, canvas, setup } from "../helpers";

describe("job queue", () => {
  it("allows one live job per run", async () => {
    const q = new MemoryQueue();
    expect(await q.enqueue("r1", "run")).not.toBeNull();
    expect(await q.enqueue("r1", "resume")).toBeNull();
    const job = await q.claim("w", 60);
    await q.complete(job!.id);
    expect(await q.enqueue("r1", "resume")).not.toBeNull();
  });

  it("reclaims a job whose lease expired (worker crashed)", async () => {
    const q = new MemoryQueue();
    let now = Date.now();
    q.now = () => now;
    await q.enqueue("r1", "run");
    expect((await q.claim("w1", 60))?.locked_by).toBe("w1");
    expect(await q.claim("w2", 60)).toBeNull();
    now += 61_000;
    const again = await q.claim("w2", 60);
    expect(again).toMatchObject({ locked_by: "w2", attempts: 2 });
  });

  it("backs off failed jobs and marks them dead after max attempts", async () => {
    const q = new MemoryQueue();
    let now = Date.now();
    q.now = () => now;
    await q.enqueue("r1", "run");
    for (let i = 1; i <= 3; i++) {
      const job = await q.claim("w", 60);
      expect(job?.attempts).toBe(i);
      expect(await q.fail(job!.id, "boom", 10)).toBe(i < 3 ? "retry" : "dead");
      expect(await q.claim("w", 60)).toBeNull(); // not before run_after
      now += 11_000;
    }
    expect(q.jobs[0].status).toBe("dead");
  });
});

describe("worker", () => {
  it("drains queued runs through the engine", async () => {
    const t = setup(canvas([agent("a"), agent("b")], [["a", "b"]]));
    const q = new MemoryQueue();
    const run = await t.store.createRun({ workflow_id: t.workflowId, input_prompt: "hi", status: "queued" });
    await q.enqueue(run.id, "run");
    const res = await drainQueue({ queue: q, engine: t.engine, store: t.store }, { workerId: "w" });
    expect(res.processed).toBe(1);
    expect((await t.store.getRun(run.id))?.status).toBe("completed");
    expect(q.jobs[0].status).toBe("done");
  });

  it("does not execute a run that was stopped while queued", async () => {
    const t = setup(canvas([agent("a")], []));
    const q = new MemoryQueue();
    const run = await t.store.createRun({ workflow_id: t.workflowId, input_prompt: "hi", status: "stopped" });
    await q.enqueue(run.id, "run");
    await drainQueue({ queue: q, engine: t.engine, store: t.store }, { workerId: "w" });
    expect(t.calls).toHaveLength(0);
  });

  it("retries infrastructure errors and fails the run when attempts run out", async () => {
    const q = new MemoryQueue();
    const store = { getRun: vi.fn(async () => ({ id: "r1", status: "running", workflow_id: "w", input_prompt: "x" }) as never), updateRun: vi.fn(async () => undefined) };
    const engine = { runWorkflow: vi.fn(async () => { throw new Error("db timeout"); }), resumeWorkflow: vi.fn() };
    await q.enqueue("r1", "run");
    const log = { log: () => {}, warn: () => {}, error: () => {} };
    let job = await q.claim("w", 60);
    expect(await processJob(job!, { queue: q, engine, store, log })).toBe("retry");
    q.jobs[0].run_after = new Date(0).toISOString();
    job = await q.claim("w", 60);
    await processJob(job!, { queue: q, engine, store, log });
    q.jobs[0].run_after = new Date(0).toISOString();
    job = await q.claim("w", 60);
    expect(await processJob(job!, { queue: q, engine, store, log })).toBe("dead");
    expect(store.updateRun).toHaveBeenCalledWith("r1", expect.objectContaining({ status: "failed" }));
  });

  it("completes the job when the engine recorded a business failure on the run", async () => {
    const t = setup(canvas([agent("a"), agent("b")], [["a", "b"], ["b", "a"]]));
    const q = new MemoryQueue();
    const run = await t.store.createRun({ workflow_id: t.workflowId, input_prompt: "hi", status: "queued" });
    await q.enqueue(run.id, "run");
    await drainQueue({ queue: q, engine: t.engine, store: t.store, log: { log() {}, warn() {}, error() {} } }, { workerId: "w" });
    expect(q.jobs[0]).toMatchObject({ status: "done" });
    expect((await t.store.getRun(run.id))?.status).toBe("failed");
  });
});
