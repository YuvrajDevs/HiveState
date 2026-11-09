import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { errorResponse, HttpError, UUID_RE } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new HttpError(400, "Invalid workflow id.");
    const { data, error } = await supabaseAdmin
      .from("workflow_versions")
      .select("version, note, created_at, canvas_json")
      .eq("workflow_id", id)
      .order("version", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const versions = (data || []).map((v) => ({
      version: v.version,
      note: v.note,
      created_at: v.created_at,
      nodeCount: (v.canvas_json as { nodes?: unknown[] })?.nodes?.length || 0,
    }));
    return NextResponse.json({ versions });
  } catch (err) {
    return errorResponse(err, "versions");
  }
}
