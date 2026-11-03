import { NextRequest, NextResponse } from "next/server";
import { runWorkflow, assertBudgetAvailable, BudgetExceededError } from "@/lib/engine/runner";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { workflowId, input } = await req.json();

    if (!workflowId) {
      return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
    }

    if (!input) {
      return NextResponse.json({ error: "Missing input prompt" }, { status: 400 });
    }

    console.log(`🚀 API: Manual trigger for workflow ${workflowId}`);

    const { data: workflow } = await supabaseAdmin.from("workflows").select("id").eq("id", workflowId).maybeSingle();
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Refuse up front (with a clear message) instead of failing silently in the background
    await assertBudgetAvailable();
    
    // 1. Create the Run entry first to get an ID
    const { data: newRun, error: runErr } = await supabaseAdmin
      .from("runs")
      .insert({
        workflow_id: workflowId,
        input_prompt: input,
        status: "running"
      })
      .select()
      .single();

    if (runErr || !newRun) throw new Error(`Run creation failed: ${runErr?.message || 'Unknown error'}`);

    // 2. Start the engine in the background (don't await)
    // We pass the existing runId to the runner
    runWorkflow(workflowId, input, newRun.id, { fresh: true }).catch(err => {
      console.error(`❌ Background Execution Error for ${newRun.id}:`, err.message);
    });

    // 3. Return the ID immediately for redirection
    return NextResponse.json({ runId: newRun.id, status: "started" });
  } catch (error: any) {
    console.error("❌ API Error:", error.message);
    const status = error instanceof BudgetExceededError ? 402 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function GET() {
  try {
    const { data: runs, error } = await supabaseAdmin
      .from("runs")
      .select("workflow_id, status, started_at");

    if (error) throw error;

    return NextResponse.json({ runs });
  } catch (error: any) {
    console.error("❌ API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
