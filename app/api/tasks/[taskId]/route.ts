import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;

    const { data: run, error } = await supabaseAdmin
      .from("runs")
      .select(`
        id,
        status,
        workflow_id,
        input_prompt,
        started_at,
        updated_at,
        total_cost,
        total_tokens,
        total_duration_ms,
        paused_node_id,
        workflow:workflows(id, name)
      `)
      .eq("id", taskId)
      .single();

    if (error || !run) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
