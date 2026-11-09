import "server-only";
import { createEngine, BudgetExceededError, type Engine } from "./engine";
import { getStore } from "@/lib/store/supabase";
import { getModelHub } from "@/lib/models";

/** The engine wired to Supabase and the real model providers. */
let engine: Engine | null = null;
function getEngine(): Engine {
  engine ??= createEngine({ store: getStore(), models: getModelHub() });
  return engine;
}

export { BudgetExceededError };

export function runWorkflow(workflowId: string, input: string, runId?: string, opts?: { fresh?: boolean }) {
  return getEngine().runWorkflow(workflowId, input, runId, opts);
}

export function resumeWorkflow(runId: string) {
  return getEngine().resumeWorkflow(runId);
}

export function assertBudgetAvailable() {
  return getEngine().assertBudgetAvailable();
}
