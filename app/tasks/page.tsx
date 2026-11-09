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
      pause_reason,
      error,
      circuit_breaker_triggered,
      consecutive_failures_count,
      parent_run_id,
      workflow:workflows(id, name)
    `)
    .order("started_at", { ascending: false })
    .limit(500);

  const { data: workflows } = await supabaseAdmin
    .from("workflows")
    .select("id, name")
    .order("name");

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 p-6">
        <AlertTriangle className="mb-2 h-5 w-5 text-red-400" />
        <h2 className="text-sm font-semibold text-red-200">Couldn&apos;t load run history</h2>
        <p className="mt-1 font-mono-data text-xs text-red-200/80">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex items-end justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Run history</h1>
          <p className="text-neutral-400 text-sm max-w-lg">
            Every run across your workflows, newest first (last 500). Filter, open a run to inspect its steps, or re-run it.
          </p>
        </div>
        <div className="hidden md:flex text-xs font-mono-data bg-white/5 border border-white/5 px-3 py-1 items-center gap-2 uppercase tracking-widest text-muted/85">
          <Activity className="w-3 h-3 text-accent" />
          Active now: {tasks?.filter(t => ['queued', 'running', 'resumed'].includes(t.status)).length || 0}
        </div>
      </header>

      <TasksContent initialTasks={tasks || []} workflows={workflows || []} />
    </div>
  );
}
