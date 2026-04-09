import { supabaseAdmin } from "@/lib/supabase";
import { Activity, AlertTriangle } from "lucide-react";
import TasksContent from "@/components/tasks/TasksContent";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { data: tasks, error } = await supabaseAdmin
    .from("runs")
    .select(`
      id,
      workflow_id,
      status,
      started_at,
      completed_at,
      total_cost,
      total_tokens,
      total_duration_ms,
      workflow:workflows(id, name)
    `)
    .order("started_at", { ascending: false });

  const { data: workflows } = await supabaseAdmin
    .from("workflows")
    .select("id, name")
    .order("name");

  if (error) {
    return (
      <div className="p-12 text-center brutalist-border bg-red-500/5">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-500">Registry Sync Failed</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex items-end justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase tracking-tighter">Task History</h1>
          <p className="text-muted text-sm max-w-lg italic opacity-70">
            Monitoring global workflow executions and agent cluster performance.
          </p>
        </div>
        <div className="hidden md:flex text-[10px] font-mono-data bg-white/5 border border-white/5 px-3 py-1 items-center gap-2 uppercase tracking-widest text-muted/50">
          <Activity className="w-3 h-3 text-accent" />
          Active_Sessions: {tasks?.filter(t => t.status === 'running').length || 0}
        </div>
      </header>

      <TasksContent initialTasks={tasks || []} workflows={workflows || []} />

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[10px] font-mono-data text-muted/30 border-t border-white/5 pt-4">
        <div className="flex gap-4">
          <span>Total_Tasks_Captured: {tasks?.length || 0}</span>
          <span>Status: CLUSTER_ONLINE</span>
        </div>
        <div className="text-accent underline cursor-not-allowed uppercase tracking-widest font-bold opacity-30">
          Sync_Node_Beta
        </div>
      </div>
    </div>
  );
}
