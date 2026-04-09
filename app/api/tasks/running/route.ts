import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch active tasks (no limit, we want to see all of them)
    const { data: activeRuns, error: activeError } = await supabaseAdmin
      .from("runs")
      .select("id, workflow_id, status, started_at, total_cost")
      .in("status", ["running", "paused_hitl", "paused_error"])
      .order("started_at", { ascending: false });

    // 2. Fetch recent finished tasks (up to 10 to fill space)
    const { data: finishedRuns, error: finishedError } = await supabaseAdmin
      .from("runs")
      .select("id, workflow_id, status, started_at, total_cost")
      .in("status", ["completed", "failed"])
      .order("started_at", { ascending: false })
      .limit(9);

    if (activeError || finishedError) throw activeError || finishedError;

    // 3. Prioritize active runs, then fill up to 10 with finished runs
    const runs = [...(activeRuns || [])];
    const finishedToAdd = (finishedRuns || []).slice(0, Math.max(0, 9 - runs.length));
    runs.push(...finishedToAdd);

    // 2. Fetch failed tasks from last 30 seconds to show error popups
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: failedRuns } = await supabaseAdmin
      .from("runs")
      .select("id, status, error, workflow:workflows(name)")
      .eq("status", "failed")
      .gt("completed_at", thirtySecondsAgo);

    if (runs.length === 0 && (!failedRuns || failedRuns.length === 0)) {
      return NextResponse.json({ tasks: [], alerts: [] });
    }

    const runningRunIds = runs.map(r => r.id);
    
    // 3. Get log counts for progress
    let logCounts: Record<string, number> = {};
    if (runningRunIds.length > 0) {
      const { data: logs } = await supabaseAdmin
        .from("logs")
        .select("run_id")
        .in("run_id", runningRunIds);
      
      logCounts = (logs || []).reduce((acc: any, log: any) => {
        acc[log.run_id] = (acc[log.run_id] || 0) + 1;
        return acc;
      }, {});
    }

    // 4. Get workflow node counts
    const workflowIds = Array.from(new Set(runs.map(r => r.workflow_id)));
    const { data: workflows } = await supabaseAdmin
      .from("workflows")
      .select("id, canvas_json")
      .in("id", workflowIds);

    const canvasMap: Record<string, number> = {};
    (workflows || []).forEach((w: any) => {
      const canvas = typeof w.canvas_json === 'string' ? JSON.parse(w.canvas_json) : (w.canvas_json || {});
      canvasMap[w.id] = canvas.nodes?.length || 0;
    });

    // 5. Build response
    const tasks = runs.map(run => ({
      ...run,
      progress: canvasMap[run.workflow_id] ? Math.min(Math.round(((logCounts[run.id] || 0) / canvasMap[run.workflow_id]) * 100), 100) : 0
    }));

    return NextResponse.json({ 
      tasks,
      alerts: failedRuns?.map(f => ({
        id: f.id,
        message: `Task Fail: ${(f.workflow as any)?.name || 'Unknown'} - ${f.error || 'Engine Interrupted'}`
      })) || []
    });

  } catch (err: any) {
    console.error("Monitoring API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
