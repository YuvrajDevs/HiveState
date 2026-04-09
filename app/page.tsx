import { supabaseAdmin } from "@/lib/supabase";
import { LayoutDashboard, Command, ShieldAlert, Plus, ArrowRight, Activity, Play, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StopTaskButton } from "@/components/tasks/StopTaskButton";
import { ActiveTasksStream } from "@/components/dashboard/ActiveTasksStream";
import { BudgetCard } from "@/components/dashboard/BudgetCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch workflows with their current state
  const { data: workflowsRaw, error } = await supabaseAdmin
    .from("workflows")
    .select("id, name, created_at, canvas_json");

  if (error) {
    console.error("Dashboard workflow fetch error:", error);
  }

  // Fetch runs for all these workflows to calculate stats
  const { data: runs, error: runsError } = await supabaseAdmin
    .from("runs")
    .select("id, workflow_id, status, started_at, total_cost");

  if (runsError) {
    console.error("Dashboard runs fetch error:", runsError);
  }

  // Process workflows and calculate stats
  const workflowsWithStats = (workflowsRaw || []).map((workflow: any) => {
    const workflowRuns = (runs || []).filter(r => r.workflow_id === workflow.id);
    const totalRuns = workflowRuns.length;
    const successfulRuns = workflowRuns.filter(r => r.status === 'completed').length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
    
    // Sort runs by started_at to get the latest
    const lastRun = workflowRuns.sort((a, b) => 
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];

    const canvas = typeof workflow.canvas_json === 'string' 
      ? JSON.parse(workflow.canvas_json) 
      : (workflow.canvas_json || {});
    const nodeCount = canvas.nodes?.length || 0;

    return {
      ...workflow,
      totalRuns,
      successRate,
      lastRunTime: lastRun?.started_at || null,
      nodeCount
    };
  });

  // Sort by most used (totalRuns) descending and take top 6
  const sortedWorkflows = [...workflowsWithStats]
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 6);

  // Global Metrics
  const totalRuns = runs?.length || 0;
  const completedRuns = runs?.filter(r => r.status === 'completed').length || 0;
  const globalSuccessRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const totalSpend = runs?.reduce((acc, r) => acc + (Number(r.total_cost) || 0), 0) || 0;

  // Recent tasks for the stream (top 10 regardless of status)
  const recentRuns = [...(runs || [])]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 10);

  const runningRunIds = recentRuns.filter(r => r.status === 'running').map(r => r.id);
  
  // Pre-calculate workflow node counts for progress
  const canvasMap: Record<string, number> = {};
  (workflowsRaw || []).forEach((w: any) => {
    const canvas = typeof w.canvas_json === 'string' ? JSON.parse(w.canvas_json) : (w.canvas_json || {});
    canvasMap[w.id] = canvas.nodes?.length || 0;
  });

  let logCounts: Record<string, number> = {};
  if (runningRunIds.length > 0) {
    const { data: logCountsRaw } = await supabaseAdmin
      .from("logs")
      .select("run_id")
      .in("run_id", runningRunIds);
    
    logCounts = (logCountsRaw || []).reduce((acc: any, log: any) => {
      acc[log.run_id] = (acc[log.run_id] || 0) + 1;
      return acc;
    }, {});
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="modern-card border-none bg-accent/5 p-6 relative overflow-hidden rounded-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
          <LayoutDashboard className="w-48 h-48" />
        </div>
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1 uppercase tracking-[0.1em]">Control Plane</h1>
            <p className="text-muted/60 text-xs max-w-lg italic">
              HiveState V0.1 — Orchestrating autonomous agent clusters with Gemini 1.5.
            </p>
          </div>
          <Link 
            href="/run"
            className="bg-accent text-white px-5 py-2.5 text-[10px] font-bold rounded-lg hover:shadow-lg hover:shadow-accent/20 transition-all flex items-center gap-2 uppercase tracking-widest no-underline"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Initiate Task
          </Link>
        </div>
      </header>

      {/* Recent Activity Stream (Client Component) */}
      <section className="animate-in fade-in slide-in-from-top-4 duration-500">
        <ActiveTasksStream 
          initialTasks={recentRuns.map(run => ({
            ...run,
            progress: canvasMap[run.workflow_id] ? Math.min(Math.round(((logCounts[run.id] || 0) / canvasMap[run.workflow_id]) * 100), 100) : 0
          }))}
          workflows={workflowsRaw || []}
        />
      </section>

      {/* Grid: Workflows and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Workflow List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 px-1">
            <h2 className="text-[10px] font-bold text-muted/50 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className="w-3 h-3 text-accent" />
              Most Used Workflows
            </h2>
            <Link 
              href="/workflows"
              className="text-[9px] text-accent/60 hover:text-accent font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              View All <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedWorkflows.length > 0 ? (
              sortedWorkflows.map((workflow: any) => (
                <div 
                  key={workflow.id} 
                  className="group modern-card p-5 hover:border-accent/40 hover:bg-white/[0.02] relative overflow-hidden rounded-xl shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-9 h-9 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-center group-hover:border-accent/30 transition-all">
                        <Command className="w-4 h-4 text-muted/60 group-hover:text-accent transition-colors" />
                      </div>
                      <div className="flex flex-col items-end gap-1 opacity-40">
                        <div className="flex items-center gap-1.5 ">
                          <div className="w-1 h-1 rounded-full bg-accent" />
                          <span className="text-[9px] font-mono-data tracking-wider uppercase">
                            {workflow.nodeCount} Nodes
                          </span>
                        </div>
                        <span className="text-[8px] font-mono-data uppercase tracking-tighter">
                          SR: {workflow.successRate}%
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-sm mb-1 group-hover:text-accent transition-colors uppercase tracking-tight text-foreground/90">
                      {workflow.name}
                    </h3>
                    <div className="flex items-center gap-4 text-[9px] font-mono-data text-muted/30 uppercase tracking-widest mb-6">
                      <span className="flex items-center gap-1">Tasks: {workflow.totalRuns}</span>
                      {workflow.lastRunTime && (
                        <span className="flex items-center gap-1">
                          Last: {formatDistanceToNow(new Date(workflow.lastRunTime))} ago
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-white/5 relative z-10">
                    <Link 
                      href={`/workflows/${workflow.id}`}
                      className="flex-1 text-center py-2 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-wider transition-all border border-white/5 text-muted hover:text-foreground"
                    >
                      Edit Canvas
                    </Link>
                    <Link
                      href={`/run?id=${workflow.id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-accent/10 hover:bg-accent/20 text-[9px] font-bold uppercase tracking-wider transition-all border border-accent/20 text-accent group/run"
                    >
                      <Play className="w-3 h-3 fill-current group-hover/run:scale-110 transition-transform" />
                      Run
                    </Link>
                  </div>
                  
                  {/* Visual Flair */}
                  <div className="absolute top-[-10px] right-[-10px] p-2 opacity-[0.01] scale-150 rotate-12 group-hover:opacity-[0.03] transition-opacity">
                    <Command className="w-20 h-20" />
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full border border-dashed border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-white/[0.01]">
                <Command className="w-8 h-8 text-muted/10 mb-4" />
                <h3 className="text-[10px] font-bold text-muted/30 uppercase tracking-[0.2em]">Deployment Registry Offline</h3>
                <p className="text-[9px] text-muted/10 items-center justify-center max-w-[200px] mt-2 font-mono-data uppercase">
                  No workflows found in this sector. Connect a cluster to begin operations.
                </p>
                <Link 
                  href="/workflows" 
                  className="mt-6 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-muted/40 uppercase tracking-widest hover:bg-white/10 transition-all no-underline"
                >
                  Create Workflow
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Stats */}
        <aside className="space-y-4">
          <BudgetCard />
          
          <div className="modern-card p-5 space-y-5 rounded-xl border-white/5 bg-white/[0.01]">
            <h3 className="text-[9px] font-bold text-muted/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Cluster Metrics</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center group">
                <span className="text-[9px] uppercase text-muted/50 tracking-wider">Active Tasks</span>
                <span className="text-lg font-bold font-mono-data tabular-nums text-foreground/80 group-hover:text-accent">
                  {(runs?.filter(r => r.status === 'running').length || 0).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="text-[9px] uppercase text-muted/50 tracking-wider">Global Success Rate</span>
                <span className="text-lg font-bold font-mono-data text-accent tabular-nums">
                  {globalSuccessRate}%
                </span>
              </div>
              <div className="flex justify-between items-center text-green-500/80 bg-green-500/[0.03] px-3 py-2 rounded-lg border border-green-500/10">
                <span className="text-[9px] uppercase tracking-wider font-bold">Protocol Status</span>
                <span className="text-[9px] font-bold">SECURE_SYNC</span>
              </div>
            </div>
          </div>

          <div className="border border-dashed border-white/10 p-5 rounded-xl bg-black/20 flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-5 h-5 text-muted/20 mb-3" />
            <p className="text-[8px] text-muted/30 uppercase tracking-[0.2em] leading-relaxed">
              Security Protocol active // <br/>Trace logging enabled
            </p>
          </div>
        </aside>

      </div>
    </div>
  );
}
