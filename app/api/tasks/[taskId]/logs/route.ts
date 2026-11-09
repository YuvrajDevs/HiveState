import { LOG_FIELDS } from "@/lib/db/fields";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;

    const { data: logs, error } = await supabaseAdmin
      .from("logs")
      .select(LOG_FIELDS)
      .eq("run_id", taskId)
      .order("created_at", { ascending: true }); // Chronological for timeline

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
