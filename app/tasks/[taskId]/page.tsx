import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import TaskDetailContent from "@/components/tasks/TaskDetailContent";
import { UUID_RE } from "@/lib/http/errors";
import { RUN_FIELDS, LOG_FIELDS } from "@/lib/db/fields";


export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  if (!UUID_RE.test(taskId)) notFound();

  const [{ data: run, error }, { data: logs }] = await Promise.all([
    supabaseAdmin.from("runs").select(RUN_FIELDS).eq("id", taskId).maybeSingle(),
    supabaseAdmin.from("logs").select(LOG_FIELDS).eq("run_id", taskId).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (!run) notFound();

  return <TaskDetailContent initialRun={run} initialLogs={logs || []} />;
}
