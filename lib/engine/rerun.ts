import { descendants } from "./graph";
import type { RunStore } from "../store/types";
import type { RunRecord } from "./types";

/**
 * Prepares a new run from an earlier one.
 *  - Without `fromNodeId`: a clean re-run with the same input and variables.
 *  - With `fromNodeId`: results of every step that is not that node or downstream of it are copied
 *    into the new run (at zero cost), so the engine treats them as done and only re-executes the
 *    chosen step and what depends on it. Useful after editing one prompt in a long chain.
 * The run is created in `queued` state; the caller enqueues it.
 */
export async function prepareRerun(store: RunStore, sourceRunId: string, fromNodeId?: string | null): Promise<RunRecord> {
  const source = await store.getRun(sourceRunId);
  if (!source) throw new Error("Run not found.");
  if (!source.workflow_id) throw new Error("The workflow for this run was deleted, so it cannot be re-run.");
  const workflow = await store.getWorkflow(source.workflow_id);
  const canvas = workflow?.canvas_json;
  if (!workflow || !canvas) throw new Error("The workflow for this run no longer exists.");

  if (fromNodeId && !canvas.nodes.some((n) => n.id === fromNodeId)) {
    throw new Error("That step is no longer in the workflow. Re-run the whole workflow instead.");
  }

  const run = await store.createRun({
    workflow_id: source.workflow_id,
    input_prompt: source.input_prompt || "",
    variables: source.variables || {},
    status: "queued",
    parent_run_id: source.id,
    rerun_from_node_id: fromNodeId || null,
    workflow_version: workflow.current_version ?? null,
  });

  if (fromNodeId) {
    const invalid = descendants(fromNodeId, canvas.nodes, canvas.edges);
    invalid.add(fromNodeId);
    const keep = new Set(canvas.nodes.map((n) => n.id).filter((id) => !invalid.has(id)));
    const logs = (await store.listLogs(source.id)).filter((l) => l.status === "success" && keep.has(l.node_id));
    const latest = new Map<string, (typeof logs)[number]>(); // last success per node wins
    logs.forEach((l) => latest.set(l.node_id, l));
    for (const l of latest.values()) {
      await store.insertLog({
        run_id: run.id, node_id: l.node_id, node_name: l.node_name, input: l.input, output: l.output, status: "success",
        system_prompt: l.system_prompt, model_used: l.model_used, correction_note: l.correction_note,
        is_skipped: true, skip_reason: `copied from run ${source.id.slice(0, 8)}`,
        prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, step_cost: 0, duration_ms: 0,
      });
    }
  }
  return run;
}
