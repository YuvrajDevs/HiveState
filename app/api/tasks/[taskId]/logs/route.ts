import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;

    const { data: logs, error } = await supabaseAdmin
      .from("logs")
      .select(`
        id,
        node_id,
        node_name,
        input,
        output,
        system_prompt,
        status,
        error,
        error_code,
        created_at,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        step_cost,
        duration_ms,
        agent:agents(name)
      `)
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
