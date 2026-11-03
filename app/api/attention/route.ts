import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** How many runs are waiting on a human (review or error) – drives the sidebar badge. */
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("runs")
    .select("id", { count: "exact", head: true })
    .in("status", ["paused_hitl", "paused_error"]);

  if (error) return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
  return NextResponse.json({ count: count ?? 0 });
}
