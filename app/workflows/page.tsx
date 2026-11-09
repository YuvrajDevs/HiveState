import { supabaseAdmin } from "@/lib/supabase";
import WorkflowsContent from "@/components/workflows/WorkflowsContent";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const [wf, runs] = await Promise.all([
    supabaseAdmin.from("workflows").select("id, name, is_template, template_name, template_description, canvas_json, created_at, updated_at, current_version").order("created_at", { ascending: false }),
    // Only the columns needed for per-workflow stats, bounded so the page stays fast as history grows.
    supabaseAdmin.from("runs").select("workflow_id, status, started_at").order("started_at", { ascending: false }).limit(2000),
  ]);
  if (wf.error) throw new Error(wf.error.message);

  const stats = new Map<string, { runs: number; completed: number; last: string | null }>();
  for (const r of runs.data || []) {
    if (!r.workflow_id) continue;
    const s = stats.get(r.workflow_id) || { runs: 0, completed: 0, last: null };
    s.runs++;
    if (r.status === "completed") s.completed++;
    s.last ??= r.started_at;
    stats.set(r.workflow_id, s);
  }

  const rows = (wf.data || []).map((w) => {
    const s = stats.get(w.id);
    return {
      id: w.id,
      name: w.name,
      isTemplate: !!w.is_template,
      templateName: w.template_name,
      description: w.template_description,
      steps: (w.canvas_json as { nodes?: unknown[] } | null)?.nodes?.length || 0,
      version: w.current_version || 0,
      createdAt: w.created_at,
      runs: s?.runs || 0,
      successRate: s?.runs ? Math.round((s.completed / s.runs) * 100) : null,
      lastRun: s?.last || null,
    };
  });

  return <WorkflowsContent workflows={rows.filter((r) => !r.isTemplate)} templates={rows.filter((r) => r.isTemplate)} />;
}
