import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store/supabase";
import { prepareRerun } from "@/lib/engine/rerun";
import { assertBudgetAvailable } from "@/lib/engine/runner";
import { dispatchRun } from "@/lib/queue/dispatch";
import { errorResponse, HttpError, UUID_RE } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Re-runs a run, optionally only from one step onwards (earlier results are reused). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    if (!UUID_RE.test(runId)) throw new HttpError(400, "Invalid run id.");
    const body = await req.json().catch(() => ({}));
    const fromNodeId = typeof body?.fromNodeId === "string" && body.fromNodeId ? body.fromNodeId : null;
    await assertBudgetAvailable();
    const run = await prepareRerun(getStore(), runId, fromNodeId).catch((e: Error) => {
      throw new HttpError(/not found|deleted|no longer/i.test(e.message) ? 404 : 400, e.message);
    });
    await dispatchRun(run.id, "run");
    return NextResponse.json({ runId: run.id, status: "queued" }, { status: 202 });
  } catch (err) {
    return errorResponse(err, "rerun");
  }
}
