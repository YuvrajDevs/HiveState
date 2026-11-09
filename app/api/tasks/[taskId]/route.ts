import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
        pause_reason,
        error,
        completed_at,
        variables,
        share_token,
        parent_run_id,
        rerun_from_node_id,
        workflow_version,
        consecutive_failures_count,
        circuit_breaker_triggered,
        workflow:workflows(id, name, canvas_json)
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
