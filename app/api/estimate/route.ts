import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store/supabase";
import { estimateRunCost } from "@/lib/engine/estimate";
import { workflowVariables } from "@/lib/engine/template";
import { errorResponse, HttpError, parseVariables, readJson, UUID_RE } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

/** Cost estimate for a run before it starts, with today's budget headroom. */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const workflowId = typeof body.workflowId === "string" ? body.workflowId : "";
    if (!UUID_RE.test(workflowId)) throw new HttpError(400, "Missing or invalid workflowId.");
    const input = typeof body.input === "string" ? body.input : "";
    const variables = parseVariables(body.variables);

    const store = getStore();
    const workflow = await store.getWorkflow(workflowId);
    if (!workflow?.canvas_json) throw new HttpError(404, "Workflow not found.");

    const [settings, spent] = await Promise.all([store.getSettings(), store.getTodaySpend()]);
    const estimate = estimateRunCost(workflow.canvas_json, input, variables);
    const limit = Number(settings?.daily_spend_limit) || 0;
    return NextResponse.json({
      estimate,
      variables: workflowVariables(workflow.canvas_json),
      budget: { limit, spent, remaining: limit > 0 ? Math.max(0, limit - spent) : null, wouldExceed: limit > 0 && spent + estimate.high > limit },
    });
  } catch (err) {
    return errorResponse(err, "estimate");
  }
}
