import { supabaseAdmin } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";
import TracesContent from "@/components/traces/TracesContent";

export const dynamic = "force-dynamic";

export default async function TracesPage() {
  const [logsRes, workflowsRes] = await Promise.all([
    supabaseAdmin
      .from("logs")
      .select(`
        id,
        run_id,
        node_name,
        input,
        output,
        status,
        error,
        created_at,
        agent:agents(
          name,
          workflow:workflows(id, name)
        ),
        run:runs(
          status,
          workflow:workflows(id, name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("workflows")
      .select("id, name")
      .order("name")
  ]);

  const { data: logs, error } = logsRes;
  const { data: workflows } = workflowsRes;

  if (error) {
    return (
      <div className="p-12 text-center brutalist-border bg-white/[0.04]">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold text-danger">Could not load trace</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Traces</h1>
          <p className="text-muted text-sm max-w-lg italic opacity-70">
            Every step of every run: what went in, what came out, and what it cost. 
            Newest first.
          </p>
        </div>
      </header>

      <TracesContent initialLogs={logs || []} workflows={workflows || []} />

      <p className="border-t border-border pt-4 text-xs text-muted">{logs?.length || 0} steps logged, newest first.</p>
    </div>
  );
}
