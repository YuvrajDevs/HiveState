import { describe, expect, it } from "vitest";
import { agent, canvas, echo, httpError, setup } from "../helpers";
import { BudgetExceededError, CIRCUIT_BREAKER_THRESHOLD } from "@/lib/engine/engine";
import { prepareRerun } from "@/lib/engine/rerun";

describe("runner: scheduling", () => {
  it("runs a linear chain in order and passes each output downstream", async () => {
    const t = setup(canvas([agent("a"), agent("b"), agent("c")], [["a", "b"], ["b", "c"]]));
    const res = await t.engine.runWorkflow(t.workflowId, "hello");
    expect(res.status).toBe("completed");
    const run = await t.store.getRun(res.runId);
    expect(run?.status).toBe("completed");
    const out = t.stepsOf(res.runId).map((l) => [l.node_id, l.output]);
    expect(out).toEqual([
      ["a", "a(hello)"],
      ["b", "b(a(hello))"],
      ["c", "c(b(a(hello)))"],
    ]);
  });

  it("runs independent branches of the same level in parallel", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const t = setup(canvas([agent("root"), agent("x"), agent("y"), agent("z")], [["root", "x"], ["root", "y"], ["root", "z"]]), async (req) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return echo(req);
    });
    const res = await t.engine.runWorkflow(t.workflowId, "go");
    expect(res.status).toBe("completed");
    expect(maxInFlight).toBe(3);
  });

  it("merges several parents into a labelled JSON input and tells the agent so", async () => {
    const t = setup(canvas([agent("a"), agent("b"), agent("m")], [["a", "m"], ["b", "m"]]));
    const res = await t.engine.runWorkflow(t.workflowId, "in");
    const merge = t.stepsOf(res.runId).find((l) => l.node_id === "m")!;
    expect(JSON.parse(merge.input!)).toEqual({
      inputs: [
        { source_node: "A", content: "a(in)" },
        { source_node: "B", content: "b(in)" },
      ],
    });
    expect(t.calls.find((c) => c.prompt === merge.input)?.system).toMatch(/multiple inputs/);
  });

  it("rejects graphs with a cycle before creating any steps", async () => {
    const t = setup(canvas([agent("a"), agent("b")], [["a", "b"], ["b", "a"]]));
    await expect(t.engine.runWorkflow(t.workflowId, "x")).rejects.toThrow(/loop/);
    expect(t.store.logs).toHaveLength(0);
  });

  it("fails a run for an empty workflow with a clear message", async () => {
    const t = setup(canvas([], []));
    await expect(t.engine.runWorkflow(t.workflowId, "x")).rejects.toThrow(/empty/);
  });
});

describe("runner: variables, streaming and cost", () => {
  it("renders {{variables}} into prompts and input", async () => {
    const t = setup(canvas([agent("a", { systemPrompt: "Research {{company}} for {{team}}" })], []));
    const run = await t.store.createRun({ workflow_id: t.workflowId, input_prompt: "About {{company}}", status: "queued", variables: { company: "Acme", team: "sales" } });
    await t.engine.runWorkflow(t.workflowId, run.input_prompt!, run.id, { fresh: true });
    expect(t.calls[0].system).toBe("Research Acme for sales");
    expect(t.calls[0].prompt).toBe("About Acme");
  });

  it("writes streamed text into the step row while it runs, then the final result", async () => {
    let seenPartial = "";
    const t = setup(canvas([agent("a")], []));
    t.setHandler(async (req) => {
      req.onDelta?.("Hello ");
      await new Promise((r) => setTimeout(r, 20));
      seenPartial = t.store.logs[0].output || "";
      expect(t.store.logs[0].status).toBe("running");
      req.onDelta?.("world");
      return { text: "Hello world", inputTokens: 1000, outputTokens: 1000 };
    });
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(seenPartial).toBe("Hello ");
    const step = t.stepsOf(res.runId)[0];
    expect(step).toMatchObject({ status: "success", output: "Hello world", prompt_tokens: 1000, completion_tokens: 1000 });
    // gemini-2.5-flash: $0.30 + $2.50 per 1M tokens, at 88 INR/USD
    expect(step.step_cost).toBeCloseTo((0.3 + 2.5) / 1000 * 88, 6);
    expect((await t.store.getRun(res.runId))?.total_cost).toBeCloseTo(step.step_cost!, 6);
  });
});

describe("runner: retries, timeouts and fallback", () => {
  it("retries a transient failure and records the attempts", async () => {
    let n = 0;
    const t = setup(canvas([agent("a", { retries: 2 })], []), (req) => {
      if (++n < 3) throw httpError(503, "overloaded");
      return echo(req);
    });
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(res.status).toBe("completed");
    expect(t.stepsOf(res.runId)[0]).toMatchObject({ status: "success", attempts: 3 });
  });

  it("does not retry a non-transient error", async () => {
    let n = 0;
    const t = setup(canvas([agent("a", { retries: 3 })], []), () => {
      n++;
      throw httpError(400, "bad request");
    });
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(res.status).toBe("paused_error");
    expect(n).toBe(1);
    expect(t.stepsOf(res.runId)[0]).toMatchObject({ status: "failed", error_code: "HTTP_400" });
  });

  it("times out a slow step and pauses the run", async () => {
    const t = setup(canvas([agent("a", { retries: 0, timeoutMs: 1000 })], []), (req) => new Promise((_, reject) => req.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const started = Date.now();
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(Date.now() - started).toBeLessThan(3000);
    expect(res.status).toBe("paused_error");
    expect(t.stepsOf(res.runId)[0]).toMatchObject({ status: "failed", error_code: "TIMEOUT" });
  });

  it("falls back to the governance fallback model when the primary keeps failing", async () => {
    const t = setup(canvas([agent("a", { retries: 1, model: "claude-sonnet-5-5" })], []), (req) => {
      if (req.model === "claude-sonnet-5-5") throw httpError(529, "overloaded");
      return echo(req);
    });
    t.store.settings.fallback_model = "gemini-2.5-flash-lite";
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(res.status).toBe("completed");
    expect(t.stepsOf(res.runId)[0]).toMatchObject({ model_used: "gemini-2.5-flash-lite", fallback_triggered: true, attempts: 3 });
  });
});

describe("runner: pause, resume and failure handling", () => {
  it("keeps successful siblings when one branch fails, and only re-runs the failure on resume", async () => {
    let failB = true;
    const t = setup(canvas([agent("a"), agent("b", { retries: 0 }), agent("c")], [["a", "c"], ["b", "c"]]), (req) => {
      if (req.system.startsWith("b") && failB) throw httpError(400, "nope");
      return echo(req);
    });
    const first = await t.engine.runWorkflow(t.workflowId, "x");
    expect(first).toMatchObject({ status: "paused_error", failedNodeId: "b" });
    const callsBefore = t.calls.length;
    failB = false;
    const second = await t.engine.resumeWorkflow(first.runId);
    expect(second.status).toBe("completed");
    const reran = t.calls.slice(callsBefore).map((c) => c.system.match(/(\w+) agent$/)?.[1]);
    expect(reran.sort()).toEqual(["b", "c"]); // "a" was not called again
  });

  it("trips the circuit breaker after repeated failures", async () => {
    const t = setup(canvas([agent("a", { retries: 0 })], []), () => {
      throw httpError(400, "always");
    });
    let res = await t.engine.runWorkflow(t.workflowId, "x");
    for (let i = 1; i < CIRCUIT_BREAKER_THRESHOLD; i++) res = await t.engine.resumeWorkflow(res.runId);
    expect(res.circuitBreakerTriggered).toBe(true);
    expect(await t.store.getRun(res.runId)).toMatchObject({ pause_reason: "circuit_breaker", circuit_breaker_triggered: true });
  });

  it("pauses at a review step, then passes the input through with the reviewer's note", async () => {
    const t = setup(canvas([agent("a"), agent("review", {}, "HITLNode"), agent("c")], [["a", "review"], ["review", "c"]]));
    const paused = await t.engine.runWorkflow(t.workflowId, "x");
    expect(paused).toMatchObject({ status: "paused_hitl", pausedNodeId: "review" });
    const gate = t.stepsOf(paused.runId).find((l) => l.status === "paused_hitl")!;
    expect(gate.input).toBe("a(x)");

    await t.store.updateLog(gate.id, { status: "success", correction_note: "be brief" }); // what approveTask does
    const done = await t.engine.resumeWorkflow(paused.runId);
    expect(done.status).toBe("completed");
    expect(t.stepsOf(paused.runId).find((l) => l.node_id === "c")!.input).toBe("a(x)\n\n--- Human Feedback ---\nbe brief");
  });

  it("runs an agent with a review flag only after approval", async () => {
    const t = setup(canvas([agent("a", { is_hitl: true })], []));
    const paused = await t.engine.runWorkflow(t.workflowId, "x");
    expect(paused.status).toBe("paused_hitl");
    expect(t.calls).toHaveLength(0);
    const gate = t.stepsOf(paused.runId)[0];
    await t.store.updateLog(gate.id, { status: "success" });
    const done = await t.engine.resumeWorkflow(paused.runId);
    expect(done.status).toBe("completed");
    expect(t.calls).toHaveLength(1);
  });

  it('treats the legacy string "false" for is_hitl as off', async () => {
    const t = setup(canvas([agent("a", { is_hitl: "false" })], []));
    expect((await t.engine.runWorkflow(t.workflowId, "x")).status).toBe("completed");
  });

  it("uses a human-edited input on retry", async () => {
    const t = setup(canvas([agent("a", { retries: 0 })], []), (req) => {
      if (req.prompt === "bad") throw httpError(400, "bad input");
      return echo(req);
    });
    const res = await t.engine.runWorkflow(t.workflowId, "bad");
    await t.store.updateRun(res.runId, { input_overrides: { a: "fixed" } });
    expect((await t.engine.resumeWorkflow(res.runId)).status).toBe("completed");
    expect(t.stepsOf(res.runId).at(-1)!.output).toBe("a(fixed)");
  });

  it("stops between levels when the run is stopped", async () => {
    const t = setup(canvas([agent("a"), agent("b")], [["a", "b"]]));
    let runId = "";
    t.setHandler(async (req) => {
      runId = t.store.logs[0].run_id;
      await t.store.updateRun(runId, { status: "stopped" });
      return echo(req);
    });
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(res.status).toBe("stopped");
    expect(t.calls).toHaveLength(1);
    expect((await t.store.getRun(runId))?.status).toBe("stopped");
  });

  it("closes out a step left 'running' by a crashed worker and runs it again", async () => {
    const t = setup(canvas([agent("a")], []));
    const run = await t.store.createRun({ workflow_id: t.workflowId, input_prompt: "x", status: "running" });
    await t.store.insertLog({ run_id: run.id, node_id: "a", status: "running", output: "half" });
    const res = await t.engine.runWorkflow(t.workflowId, "x", run.id, { fresh: true });
    expect(res.status).toBe("completed");
    expect(t.stepsOf(run.id).map((l) => l.status)).toEqual(["failed", "success"]);
  });
});

describe("runner: budget guard", () => {
  it("refuses to start when today's spend is over the limit", async () => {
    const t = setup(canvas([agent("a")], []));
    t.store.settings.daily_spend_limit = 10;
    t.store.baseSpend = 10;
    await expect(t.engine.runWorkflow(t.workflowId, "x")).rejects.toBeInstanceOf(BudgetExceededError);
    expect(t.store.runs.size).toBe(0);
  });

  it("pauses mid-run when a level pushes spend over the limit", async () => {
    const t = setup(canvas([agent("a"), agent("b")], [["a", "b"]]), () => ({ text: "x", inputTokens: 1_000_000, outputTokens: 1_000_000 }));
    t.store.settings.daily_spend_limit = 1; // one step costs ~246 INR
    const res = await t.engine.runWorkflow(t.workflowId, "x");
    expect(res.status).toBe("paused_error");
    expect((await t.store.getRun(res.runId))?.pause_reason).toBe("budget_limit");
    expect(t.calls).toHaveLength(1);
  });
});

describe("re-run from a step", () => {
  it("copies upstream results and re-executes only the chosen step and its descendants", async () => {
    const t = setup(canvas([agent("a"), agent("b"), agent("c"), agent("side")], [["a", "b"], ["b", "c"], ["a", "side"]]));
    const first = await t.engine.runWorkflow(t.workflowId, "x");
    const before = t.calls.length;

    const rerun = await prepareRerun(t.store, first.runId, "b");
    expect(rerun).toMatchObject({ status: "queued", parent_run_id: first.runId, rerun_from_node_id: "b" });
    const copied = t.stepsOf(rerun.id);
    expect(copied.map((l) => l.node_id).sort()).toEqual(["a", "side"]);
    expect(copied.every((l) => l.step_cost === 0 && l.is_skipped)).toBe(true);

    const res = await t.engine.runWorkflow(t.workflowId, "x", rerun.id, { fresh: true });
    expect(res.status).toBe("completed");
    expect(t.calls.slice(before).map((c) => c.system.split(" ")[0])).toEqual(["b", "c"]);
  });

  it("refuses a step that is no longer in the workflow", async () => {
    const t = setup(canvas([agent("a")], []));
    const first = await t.engine.runWorkflow(t.workflowId, "x");
    await expect(prepareRerun(t.store, first.runId, "gone")).rejects.toThrow(/no longer/);
  });
});
