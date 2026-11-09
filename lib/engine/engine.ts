import crypto from "crypto";
import { aggregateInput, hasCycle, isHitlNode, MULTI_INPUT_PREFIX, parentMap, readyNodes } from "./graph";
import { renderTemplate } from "./template";
import { costInr } from "../models/catalog";
import type { ModelHub } from "../models/hub";
import type { RunStore } from "../store/types";
import type { CanvasNode, LogRecord, RunRecord, RunStatus } from "./types";

/**
 * The workflow engine: a dependency-aware parallel runner over the canvas DAG.
 *
 * Execution model
 *  - Nodes are scheduled level by level: every node whose parents have all succeeded runs in parallel.
 *  - Every step is persisted before and after it runs, so a run can be resumed from the database alone
 *    (after a human review, an error, a stop, or a worker crash). Successful steps are never re-run.
 *  - A step is fingerprinted (run, node, input, prompt). If a successful step with the same fingerprint
 *    exists it is reused, which makes job redelivery from the queue safe (at-least-once delivery).
 */

export class BudgetExceededError extends Error {
  code = "BUDGET_EXCEEDED";
  constructor(public limit: number) {
    super(`Daily budget exceeded (limit: ₹${limit}). Raise the limit in Settings to continue.`);
    this.name = "BudgetExceededError";
  }
}

export interface EngineDeps {
  store: RunStore;
  models: ModelHub;
  /** How often streamed text is written to the step row. */
  streamFlushMs?: number;
  log?: Pick<Console, "log" | "warn" | "error">;
}

export interface RunResult {
  runId: string;
  status: RunStatus | "stopped";
  pausedNodeId?: string;
  failedNodeId?: string;
  circuitBreakerTriggered?: boolean;
  error?: string;
}

export const CIRCUIT_BREAKER_THRESHOLD = 3;
const SUMMARY_NODE_ID = "__context_summary__";
const HITL_GATE = "hitl_gate";

export function fingerprint(runId: string, nodeId: string, input: string, systemPrompt: string): string {
  return crypto.createHash("sha256").update(`${runId}:${nodeId}:${input}:${systemPrompt}`).digest("hex");
}

/** Run totals derived from the step rows, so they are always consistent with the trace. */
export function computeTotals(logs: LogRecord[]) {
  return logs.reduce(
    (acc, l) => {
      if (l.status !== "success" && l.status !== "failed") return acc;
      acc.total_cost += Number(l.step_cost) || 0;
      acc.total_tokens += l.total_tokens || 0;
      acc.total_duration_ms += l.duration_ms || 0;
      return acc;
    },
    { total_cost: 0, total_tokens: 0, total_duration_ms: 0 },
  );
}

const STOPPED: RunStatus[] = ["failed", "aborted", "stopped"];

export function createEngine(deps: EngineDeps) {
  const { store, models } = deps;
  const log = deps.log ?? console;
  const flushMs = deps.streamFlushMs ?? 400;

  async function assertBudgetAvailable() {
    const settings = await store.getSettings();
    const limit = Number(settings?.daily_spend_limit) || 0;
    if (limit > 0 && (await store.getTodaySpend()) >= limit) throw new BudgetExceededError(limit);
  }

  async function isRunStopped(runId: string) {
    const run = await store.getRun(runId);
    return !!run && STOPPED.includes(run.status);
  }

  async function persistTotals(runId: string, patch: Partial<RunRecord>) {
    const totals = computeTotals(await store.listLogs(runId));
    await store.updateRun(runId, { ...patch, ...totals });
  }

  /** Runs one agent step with retries, a timeout, fallback and streamed output written to its step row. */
  async function executeAgentStep(run: RunRecord, node: CanvasNode, input: string, fallbackModel: string | null) {
    const vars = run.variables || {};
    const label = node.data.label || "Untitled Agent";
    const rawPrompt = node.data.systemPrompt || "You are a helpful assistant.";
    const systemPrompt = renderTemplate(rawPrompt, vars);
    const fp = fingerprint(run.id, node.id, input, systemPrompt);

    const reused = await store.findSuccessByFingerprint(fp);
    if (reused) {
      log.log(`[engine] reusing earlier result for ${label}`);
      await store.insertLog({
        run_id: run.id, node_id: node.id, node_name: label, input, output: reused.output, status: "success",
        is_skipped: true, skip_reason: "idempotent reuse", fingerprint: fp, prompt_tokens: 0, completion_tokens: 0,
        total_tokens: 0, step_cost: 0, duration_ms: 0, system_prompt: systemPrompt, model_used: reused.model_used,
      });
      return { ok: true as const, output: reused.output || "" };
    }

    const effectivePrompt = input.startsWith(MULTI_INPUT_PREFIX)
      ? `You will receive multiple inputs from different agents in a structured JSON format. Each input is labeled with its source. Combine them intelligently into a coherent output.\n\n${systemPrompt}`
      : systemPrompt;

    const step = await store.insertLog({
      run_id: run.id, node_id: node.id, node_name: label, input, output: "", status: "running",
      system_prompt: systemPrompt, fingerprint: fp, model_used: node.data.model || null, attempts: 1,
    });

    // Streaming: buffer deltas and write them at most every `flushMs`, one write in flight at a time.
    let buffer = "";
    let dirty = false;
    let writing: Promise<void> | null = null;
    const flush = () => {
      if (!dirty || writing) return;
      dirty = false;
      const snapshot = buffer;
      writing = store.updateLog(step.id, { output: snapshot }).catch(() => undefined).finally(() => (writing = null));
    };
    const timer = setInterval(flush, flushMs);
    const started = Date.now();

    try {
      const outcome = await models.call({
        model: node.data.model || "gemini-2.5-flash",
        fallbackModel,
        system: effectivePrompt,
        prompt: input,
        retries: typeof node.data.retries === "number" ? node.data.retries : undefined,
        timeoutMs: typeof node.data.timeoutMs === "number" ? node.data.timeoutMs : undefined,
        onAttemptStart: ({ attempt, model }) => {
          buffer = "";
          dirty = true;
          if (attempt > 1) store.updateLog(step.id, { attempts: attempt, model_used: model }).catch(() => undefined);
        },
        onDelta: (chunk) => {
          buffer += chunk;
          dirty = true;
        },
      });
      clearInterval(timer);
      await writing;
      const cost = costInr(outcome.modelUsed, outcome.inputTokens, outcome.outputTokens);
      await store.updateLog(step.id, {
        output: outcome.text, status: "success", prompt_tokens: outcome.inputTokens, completion_tokens: outcome.outputTokens,
        total_tokens: outcome.inputTokens + outcome.outputTokens, step_cost: cost, duration_ms: Date.now() - started,
        model_used: outcome.modelUsed, fallback_triggered: outcome.isFallback, attempts: outcome.attempts,
      });
      return { ok: true as const, output: outcome.text };
    } catch (err) {
      clearInterval(timer);
      await writing;
      const e = err as { message?: string; code?: string; status?: number; attempts?: number };
      await store.updateLog(step.id, {
        status: "failed", error: e.message || "Unknown error", error_code: e.code || (e.status ? `HTTP_${e.status}` : "UNKNOWN_ERROR"),
        duration_ms: Date.now() - started, attempts: e.attempts || 1, output: buffer || null,
      });
      return { ok: false as const, error: e.message || "Unknown error" };
    }
  }

  /**
   * Executes (or continues) a run. When `runId` is given the run row already exists;
   * `fresh` means it has not started yet, so first-run setup (context summary) applies.
   */
  async function runWorkflow(workflowId: string, input: string, runId?: string, opts?: { fresh?: boolean }): Promise<RunResult> {
    let currentRunId = runId;
    try {
      const workflow = await store.getWorkflow(workflowId);
      if (!workflow) throw new Error("Workflow not found. It may have been deleted.");
      const canvas = workflow.canvas_json;
      if (!canvas) throw new Error("This workflow has no canvas yet. Open it in the editor and add an agent.");
      const nodes = canvas.nodes || [];
      const edges = canvas.edges || [];
      if (nodes.length === 0) throw new Error("This workflow is empty. Add at least one agent.");
      if (hasCycle(nodes, edges)) throw new Error("The workflow has a loop. Remove the circular connection and try again.");
      const parents = parentMap(nodes, edges);
      if (readyNodes(nodes, parents, new Set()).length === 0) throw new Error("The workflow has no starting step.");

      const settings = await store.getSettings();
      const useOptimization = !!settings?.context_optimization_enabled;
      const fallbackModel = settings?.fallback_model || null;

      let run: RunRecord;
      if (!currentRunId) {
        await assertBudgetAvailable();
        run = await store.createRun({
          workflow_id: workflowId, input_prompt: input, status: "running", is_optimized: useOptimization,
          workflow_version: workflow.current_version ?? null,
        });
        currentRunId = run.id;
      } else {
        const existing = await store.getRun(currentRunId);
        if (!existing) throw new Error("Run not found.");
        run = existing;
        await store.updateRun(currentRunId, { status: "running", error: null });
      }
      const rid = currentRunId;
      const vars = run.variables || {};

      // A previous worker may have died mid-step. Those rows are closed out so the step runs again.
      for (const l of await store.listLogs(rid)) {
        if (l.status === "running") await store.updateLog(l.id, { status: "failed", error: "Interrupted before it finished; retried.", error_code: "INTERRUPTED" });
      }

      if ((!runId || opts?.fresh) && useOptimization && input && input.length > 500 && !run.context_summary) {
        try {
          const s = await models.call({
            model: settings?.primary_model || "gemini-2.5-flash-lite",
            fallbackModel,
            system: "Summarize this content into a compact context header preserving key intent (20-50 tokens).",
            prompt: renderTemplate(input, vars),
            retries: 1,
            timeoutMs: 30_000,
          });
          await store.updateRun(rid, { context_summary: s.text });
          run.context_summary = s.text;
          await store.insertLog({
            run_id: rid, node_id: SUMMARY_NODE_ID, node_name: "Context summary", input: input.slice(0, 2000), output: s.text,
            status: "success", prompt_tokens: s.inputTokens, completion_tokens: s.outputTokens, total_tokens: s.inputTokens + s.outputTokens,
            step_cost: costInr(s.modelUsed, s.inputTokens, s.outputTokens), model_used: s.modelUsed, is_skipped: false,
          });
        } catch (err) {
          log.warn("[engine] context summary failed; continuing with the full input", err);
        }
      }

      const rootInput = renderTemplate(run.context_summary || input, vars);

      // Rebuild state from the step rows: this is what makes every resume path work.
      const completed = new Set<string>();
      const approvedGates = new Set<string>();
      const outputs = new Map<string, string>();
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      for (const l of await store.listLogs(rid)) {
        if (l.status !== "success") continue;
        const node = nodeById.get(l.node_id);
        if (!node) continue;
        if (l.skip_reason === HITL_GATE && node.type !== "HITLNode" && node.type !== "human") {
          approvedGates.add(node.id); // reviewer approved; the agent itself still has to run
          if (l.correction_note) outputs.set(`${node.id}:note`, l.correction_note);
          continue;
        }
        let out = l.output ?? l.input ?? ""; // a review step passes its input through
        if (l.correction_note) out = `${out}\n\n--- Human Feedback ---\n${l.correction_note}`;
        outputs.set(l.node_id, out);
        completed.add(l.node_id);
      }

      while (!nodes.every((n) => completed.has(n.id))) {
        if (await isRunStopped(rid)) return { runId: rid, status: "stopped" };

        const ready = readyNodes(nodes, parents, completed);
        if (ready.length === 0) throw new Error("Execution stalled: some steps can never run.");

        const gate = ready.find((n) => isHitlNode(n) && !approvedGates.has(n.id));
        if (gate) {
          const gateInput = aggregateInput(gate, parents, outputs, nodes, rootInput);
          const pending = (await store.listLogs(rid)).find((l) => l.node_id === gate.id && l.status === "paused_hitl");
          const row = { node_name: gate.data.label || "Manual Review", input: gateInput, status: "paused_hitl" as const, skip_reason: HITL_GATE };
          if (pending) await store.updateLog(pending.id, row);
          else await store.insertLog({ run_id: rid, node_id: gate.id, ...row });
          await persistTotals(rid, { status: "paused_hitl", pause_reason: "hitl", paused_node_id: gate.id });
          log.log(`[engine] waiting for review at ${gate.data.label}`);
          return { runId: rid, status: "paused_hitl", pausedNodeId: gate.id };
        }

        log.log(`[engine] running ${ready.length} step(s) in parallel`);
        const results = await Promise.all(
          ready.map(async (node) => {
            const override = run.input_overrides?.[node.id];
            let nodeInput = override ?? aggregateInput(node, parents, outputs, nodes, rootInput);
            const note = outputs.get(`${node.id}:note`);
            if (note) nodeInput = `${nodeInput}\n\n--- Human Feedback ---\n${note}`;
            const res = await executeAgentStep(run, node, nodeInput, fallbackModel);
            return { node, ...res };
          }),
        );

        // Successful siblings are kept even if another branch failed: a retry only re-runs the failure.
        for (const r of results) {
          if (r.ok) {
            outputs.set(r.node.id, r.output);
            completed.add(r.node.id);
          }
        }

        const failed = results.find((r) => !r.ok);
        if (failed) {
          const fresh = await store.getRun(rid);
          const count = (fresh?.consecutive_failures_count || 0) + 1;
          const broken = count >= CIRCUIT_BREAKER_THRESHOLD;
          await persistTotals(rid, {
            status: "paused_error", pause_reason: broken ? "circuit_breaker" : "error", paused_node_id: failed.node.id,
            consecutive_failures_count: count, circuit_breaker_triggered: broken, error: failed.ok ? null : failed.error,
          });
          return { runId: rid, status: "paused_error", failedNodeId: failed.node.id, circuitBreakerTriggered: broken };
        }

        await store.updateRun(rid, { consecutive_failures_count: 0 });

        const limit = Number(settings?.daily_spend_limit) || 0;
        if (limit > 0 && (await store.getTodaySpend()) >= limit && !nodes.every((n) => completed.has(n.id))) {
          log.warn("[engine] daily budget reached mid-run; pausing");
          await persistTotals(rid, { status: "paused_error", pause_reason: "budget_limit", error: "Daily budget limit reached." });
          return { runId: rid, status: "paused_error", error: "Daily budget limit reached." };
        }
      }

      if (await isRunStopped(rid)) return { runId: rid, status: "stopped" };
      await persistTotals(rid, { status: "completed", paused_node_id: null, pause_reason: null, error: null, completed_at: new Date().toISOString() });
      return { runId: rid, status: "completed" };
    } catch (err) {
      const message = (err as Error).message;
      log.error("[engine] run failed:", message);
      if (currentRunId && !(err instanceof BudgetExceededError && !runId)) {
        await store.updateRun(currentRunId, { status: "failed", error: message, completed_at: new Date().toISOString() }).catch(() => undefined);
      }
      throw err;
    }
  }

  async function resumeWorkflow(runId: string): Promise<RunResult> {
    const run = await store.getRun(runId);
    if (!run) throw new Error("Run not found.");
    if (!run.workflow_id) throw new Error("The workflow for this run was deleted, so it cannot be resumed.");
    await store.updateRun(runId, { status: "resumed" });
    return runWorkflow(run.workflow_id, run.input_prompt || "", runId);
  }

  return { runWorkflow, resumeWorkflow, assertBudgetAvailable };
}

export type Engine = ReturnType<typeof createEngine>;
