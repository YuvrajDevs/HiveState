import { NextRequest, NextResponse } from "next/server";
import { assertBudgetAvailable } from "@/lib/engine/runner";
import { getStore } from "@/lib/store/supabase";
import { dispatchRun } from "@/lib/queue/dispatch";
import { workflowVariables, missingVariables } from "@/lib/engine/template";
import { errorResponse, HttpError, parseVariables, readJson, UUID_RE } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
// The run executes in after() once the response is sent; give it room to finish.
export const maxDuration = 300;

const MAX_INPUT_CHARS = 200_000;

/** Queues a run. Returns immediately with the run id; execution happens on the queue. */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const workflowId = typeof body.workflowId === "string" ? body.workflowId.trim() : "";
    const input = typeof body.input === "string" ? body.input : "";
    const variables = parseVariables(body.variables);

    if (!workflowId || !UUID_RE.test(workflowId)) throw new HttpError(400, "Missing or invalid workflowId.");
    if (!input.trim()) throw new HttpError(400, "Missing input prompt.");
    if (input.length > MAX_INPUT_CHARS) throw new HttpError(413, `Input is too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters).`);

    const store = getStore();
    const workflow = await store.getWorkflow(workflowId);
    if (!workflow) throw new HttpError(404, "Workflow not found.");
    if (!workflow.canvas_json?.nodes?.length) throw new HttpError(422, "This workflow has no steps yet. Add an agent in the editor first.");

    const missing = missingVariables(workflowVariables(workflow.canvas_json), variables);
    if (missing.length) throw new HttpError(422, `Fill in: ${missing.join(", ")}`, { missingVariables: missing });

    await assertBudgetAvailable();

    const run = await store.createRun({
      workflow_id: workflowId,
      input_prompt: input,
      variables,
      status: "queued",
      workflow_version: workflow.current_version ?? null,
    });
    const { mode } = await dispatchRun(run.id, "run");
    return NextResponse.json({ runId: run.id, status: "queued", mode }, { status: 202 });
  } catch (err) {
    return errorResponse(err, "run-workflow");
  }
}
