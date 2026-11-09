import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MemoryStore } from "@/lib/store/memory";
import { MemoryQueue } from "@/lib/queue/memory";
import { BudgetExceededError } from "@/lib/engine/engine";
import { agent, canvas } from "../helpers";

// The route handlers use these three seams; each test gets a fresh in-memory backend.
const h = vi.hoisted(() => ({
  store: null as unknown as MemoryStore,
  queue: null as unknown as MemoryQueue,
  dispatched: [] as Array<{ runId: string; kind: string }>,
}));

vi.mock("@/lib/store/supabase", () => ({ getStore: () => h.store }));
vi.mock("@/lib/queue/dispatch", () => ({
  dispatchRun: vi.fn(async (runId: string, kind: string) => {
    h.dispatched.push({ runId, kind });
    await h.queue.enqueue(runId, kind as "run");
    return { mode: "queued" };
  }),
  workerDeps: () => ({
    queue: h.queue,
    store: h.store,
    engine: { runWorkflow: async (_w: string, _i: string, runId: string) => { await h.store.updateRun(runId, { status: "completed" }); return { runId, status: "completed" }; }, resumeWorkflow: vi.fn() },
  }),
}));
vi.mock("@/lib/engine/runner", () => ({
  assertBudgetAvailable: async () => {
    const limit = Number(h.store.settings.daily_spend_limit) || 0;
    if (limit > 0 && (await h.store.getTodaySpend()) >= limit) throw new BudgetExceededError(limit);
  },
}));

import { POST as runWorkflow } from "@/app/api/run-workflow/route";
import { POST as estimate } from "@/app/api/estimate/route";
import { POST as rerun } from "@/app/api/runs/[runId]/rerun/route";
import { POST as share, DELETE as unshare } from "@/app/api/runs/[runId]/share/route";
import { GET as drain } from "@/app/api/jobs/drain/route";

const WF = "00000000-0000-4000-8000-0000000000aa";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://test/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
}
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(() => {
  h.store = new MemoryStore();
  h.queue = new MemoryQueue();
  h.dispatched = [];
  h.store.addWorkflow({ id: WF, name: "WF", canvas_json: canvas([agent("a", { systemPrompt: "Write about {{topic}}" }), agent("b")], [["a", "b"]]) });
  vi.unstubAllEnvs();
});

describe("POST /api/run-workflow", () => {
  it("queues a run with its variables and returns 202", async () => {
    const res = await runWorkflow(post({ workflowId: WF, input: "go", variables: { topic: "bees" } }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("queued");
    expect(await h.store.getRun(body.runId)).toMatchObject({ status: "queued", variables: { topic: "bees" }, input_prompt: "go" });
    expect(h.dispatched).toEqual([{ runId: body.runId, kind: "run" }]);
  });

  it.each([
    [{ input: "x" }, 400, /workflowId/],
    [{ workflowId: "not-a-uuid", input: "x" }, 400, /workflowId/],
    [{ workflowId: WF, input: "   " }, 400, /input/],
    [{ workflowId: WF, input: "x", variables: ["a"] }, 400, /variables/],
    [{ workflowId: WF, input: "x", variables: { "bad name": "1" } }, 400, /Invalid variable/],
    [{ workflowId: "00000000-0000-4000-8000-000000000999", input: "x", variables: { topic: "t" } }, 404, /not found/],
    [{ workflowId: WF, input: "x" }, 422, /topic/],
  ])("rejects %j with %i", async (body, status, msg) => {
    const res = await runWorkflow(post(body));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toMatch(msg);
    expect(h.dispatched).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    expect((await runWorkflow(post("{nope"))).status).toBe(400);
  });

  it("rejects oversized input with 413", async () => {
    const res = await runWorkflow(post({ workflowId: WF, input: "x".repeat(200_001), variables: { topic: "t" } }));
    expect(res.status).toBe(413);
  });

  it("returns 402 when today's budget is spent", async () => {
    h.store.settings.daily_spend_limit = 5;
    h.store.baseSpend = 6;
    const res = await runWorkflow(post({ workflowId: WF, input: "x", variables: { topic: "t" } }));
    expect(res.status).toBe(402);
    expect(h.store.runs.size).toBe(0);
  });
});

describe("POST /api/estimate", () => {
  it("returns an estimate, the workflow's variables and budget headroom", async () => {
    h.store.settings.daily_spend_limit = 100;
    h.store.baseSpend = 40;
    const res = await estimate(post({ workflowId: WF, input: "hello", variables: { topic: "bees" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variables).toEqual(["topic"]);
    expect(body.estimate.nodes).toHaveLength(2);
    expect(body.estimate.high).toBeGreaterThan(body.estimate.low);
    expect(body.budget).toMatchObject({ limit: 100, spent: 40, remaining: 60, wouldExceed: false });
  });
});

describe("POST /api/runs/:id/rerun", () => {
  it("creates a linked run from a step and queues it", async () => {
    const src = await h.store.createRun({ workflow_id: WF, input_prompt: "x", status: "completed" });
    await h.store.insertLog({ run_id: src.id, node_id: "a", status: "success", output: "A" });
    await h.store.insertLog({ run_id: src.id, node_id: "b", status: "success", output: "B" });
    const res = await rerun(post({ fromNodeId: "b" }), params({ runId: src.id }));
    expect(res.status).toBe(202);
    const { runId } = await res.json();
    expect(await h.store.getRun(runId)).toMatchObject({ parent_run_id: src.id, rerun_from_node_id: "b", status: "queued" });
    expect((await h.store.listLogs(runId)).map((l) => l.node_id)).toEqual(["a"]);
  });

  it("404s for an unknown run", async () => {
    const res = await rerun(post({}), params({ runId: "00000000-0000-4000-8000-000000000123" }));
    expect(res.status).toBe(404);
  });
});

describe("share links", () => {
  it("creates a stable unguessable token and revokes it", async () => {
    const run = await h.store.createRun({ workflow_id: WF, input_prompt: "x", status: "completed" });
    const first = await (await share(post({}), params({ runId: run.id }))).json();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const again = await (await share(post({}), params({ runId: run.id }))).json();
    expect(again.token).toBe(first.token);
    await unshare(post({}), params({ runId: run.id }));
    expect((await h.store.getRun(run.id))?.share_token).toBeNull();
  });
});

describe("GET /api/jobs/drain", () => {
  it("is disabled without CRON_SECRET and rejects wrong secrets", async () => {
    expect((await drain(new NextRequest("http://test/api/jobs/drain"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    const wrong = new NextRequest("http://test/api/jobs/drain", { headers: { authorization: "Bearer nope" } });
    expect((await drain(wrong)).status).toBe(401);
  });

  it("processes queued jobs with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const run = await h.store.createRun({ workflow_id: WF, input_prompt: "x", status: "queued" });
    await h.queue.enqueue(run.id, "run");
    const res = await drain(new NextRequest("http://test/api/jobs/drain", { headers: { authorization: "Bearer s3cret" } }));
    expect(await res.json()).toEqual({ processed: 1 });
    expect((await h.store.getRun(run.id))?.status).toBe("completed");
  });
});
