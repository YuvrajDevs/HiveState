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
      <div className="p-12 text-center brutalist-border bg-white/[0.04]">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold text-danger">Could not load runs</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex items-end justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Runs</h1>
          <p className="text-muted text-sm max-w-lg italic opacity-70">
            Every run of every workflow. Click a row to see its steps, cost and output.
          </p>
        </div>
        <div className="hidden md:flex text-xs bg-white/5 border border-white/5 px-3 py-1 items-center gap-2 text-muted/85">
          <Activity className="w-3 h-3 text-accent" />
          Running now: {tasks?.filter(t => t.status === 'running').length || 0}
        </div>
      </header>

      <TasksContent initialTasks={tasks || []} workflows={workflows || []} />
    </div>
  );
}
