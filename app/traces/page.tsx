import { supabaseAdmin } from "@/lib/supabase";
import { Terminal, AlertTriangle } from "lucide-react";
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
      <div className="p-12 text-center brutalist-border bg-red-500/5">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-500">Trace Fetch Failed</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase tracking-tighter">Execution Traces</h1>
          <p className="text-muted text-sm max-w-lg italic opacity-70">
            Visualizing real-time agent coordination logic and model outcomes. 
            Ordered by reverse chronological sequence.
          </p>
        </div>
        <div className="hidden md:flex text-[10px] font-mono-data bg-white/5 border border-border px-3 py-1 items-center gap-2 uppercase tracking-widest">
          <Terminal className="w-3 h-3 text-accent" />
          Live Instance: hive-trace-v1.0
        </div>
      </header>

      <TracesContent initialLogs={logs || []} workflows={workflows || []} />

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[10px] font-mono-data text-muted border-t border-border pt-4">
        <div className="flex gap-4">
          <span>Captured_Logs: {logs?.length || 0}</span>
          <span>Status: SYNC_ESTABLISHED</span>
        </div>
        <div className="text-accent underline cursor-not-allowed uppercase tracking-widest font-bold">
          Analytics_Cluster_Alpha
        </div>
      </div>
    </div>
  );
}
