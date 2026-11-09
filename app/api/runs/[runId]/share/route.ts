import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStore } from "@/lib/store/supabase";
import { errorResponse, HttpError, UUID_RE } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

/** Creates (or returns) an unguessable read-only link for a run. 24 random bytes, base64url. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    if (!UUID_RE.test(runId)) throw new HttpError(400, "Invalid run id.");
    const store = getStore();
    const run = await store.getRun(runId);
    if (!run) throw new HttpError(404, "Run not found.");
    const token = run.share_token || crypto.randomBytes(24).toString("base64url");
    if (!run.share_token) await store.updateRun(runId, { share_token: token });
    return NextResponse.json({ token, path: `/share/${token}` });
  } catch (err) {
    return errorResponse(err, "share");
  }
}

/** Revokes the link: the old URL stops working immediately. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    if (!UUID_RE.test(runId)) throw new HttpError(400, "Invalid run id.");
    await getStore().updateRun(runId, { share_token: null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "unshare");
  }
}
