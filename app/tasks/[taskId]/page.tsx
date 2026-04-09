import { supabaseAdmin } from "@/lib/supabase";
import { Terminal, AlertTriangle, ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";
import TaskDetailContent from "@/components/tasks/TaskDetailContent";
import { stopTask } from "@/app/actions/tasks";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  // Initial Fetch (SSR)
  const { data: run, error: runError } = await supabaseAdmin
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
      completed_at,
      workflow:workflows(id, name)
    `)
    .eq("id", taskId)
    .single();

  if (runError || !run) {
    return (
      <div className="p-12 text-center brutalist-border bg-red-500/5">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-500">Node Failure: Task Not Found</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{runError?.message || "Invalid Session ID"}</p>
        <Link href="/tasks" className="mt-8 px-8 py-3 inline-block bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/20 transition-all no-underline rounded-xl">
          ← Cluster Registry
        </Link>
      </div>
    );
  }

  const { data: logs } = await supabaseAdmin
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
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-4 gap-4">
        <div className="space-y-2">
          <Link href="/tasks" className="inline-flex items-center gap-2 text-[10px] text-muted/30 hover:text-accent font-bold uppercase tracking-widest transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" /> System Registry
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight uppercase tracking-wider">Session Investigation</h1>
            <div className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm ${
              run.status === "completed" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
              run.status === "failed" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
              "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse"
            }`}>
              {run.status === "completed" ? "System Success" : run.status === "failed" ? "System Failure" : "Active Runner"}
            </div>
          </div>
          <div className="text-[12px] text-muted/40 tracking-wider font-mono-data flex gap-4">
               <span className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-accent/50" />
                Cluster: <span className="text-foreground/80 font-bold">{(run.workflow as any)?.name || "Autonomous Process"}</span>
               </span>
            <span className="opacity-40">Session: <span className="text-foreground/80">{run.id}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {run.status === "running" && (
            <form action={async () => {
              "use server";
              await stopTask(run.id);
            }}>
              <button 
                type="submit"
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
              >
                Abort Sequence
              </button>
            </form>
          )}

          <div className="flex gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div className="space-y-1">
              <div className="text-[9px] text-muted/30 uppercase font-bold tracking-[0.2em]">Runtime</div>
              <div className="text-sm font-mono-data font-bold text-foreground/80">{run.total_duration_ms ? `${(run.total_duration_ms / 1000).toFixed(1)}s` : "---"}</div>
            </div>
            <div className="w-px bg-white/5 mx-1"></div>
            <div className="space-y-1">
              <div className="text-[9px] text-muted/30 uppercase font-bold tracking-[0.2em]">Compute Cost</div>
              <div className="text-sm font-mono-data font-bold text-accent/80">₹{(run.total_cost || 0).toFixed(6)}</div>
            </div>
          </div>
        </div>
      </header>

      <TaskDetailContent initialRun={run} initialLogs={logs || []} />
    </div>
  );
}
