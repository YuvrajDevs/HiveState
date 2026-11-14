import { one, type Related } from "@/types/domain";
import { STATUS_TONE, runLabel } from "@/lib/status";
import { supabaseAdmin } from "@/lib/supabase";
import { AlertTriangle, ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import TraceDetailContent from "@/components/traces/TraceDetailContent";

export const dynamic = "force-dynamic";

export default async function TraceDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  // 1. Fetch the Run Details
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
      tokens_saved,
      is_optimized,
      workflow:workflows(id, name)
    `)
    .eq("id", runId)
    .single();

  if (runError || !run) {
    return (
      <div className="p-12 text-center brutalist-border bg-white/[0.04]">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold text-danger">Run not found</h2>
        <p className="text-muted text-sm mt-2 font-mono-data">{runError?.message || "Invalid ID"}</p>
        <Link href="/traces" className="mt-6 inline-block text-xs font-semibold text-accent hover:underline">
          ← Return to Traces
        </Link>
      </div>
    );
  }

  // 2. Fetch the corresponding logs (Steps)
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
      model_used,
      fallback_triggered,
      agent:agents(name)
    `)
    .eq("run_id", runId)
    .order("created_at", { ascending: true }); // Chronological

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-4 mb-4 gap-4">
        <div className="space-y-2">
          <Link href="/traces" className="inline-flex items-center gap-2 text-xs text-muted/85 hover:text-accent font-semibold transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" /> All traces
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Run trace</h1>
            <div className={`px-2 py-0.5 text-xs font-semibold rounded-sm ${
              STATUS_TONE[runLabel(run.status).tone].chip
            }`}>
              {runLabel(run.status).text}
            </div>
          </div>
          <div className="text-xs text-muted/85 font-mono-data flex gap-4">
            <span>Workflow: <span className="text-foreground/80 font-bold">{one(run.workflow as Related<{ name: string }>)?.name || "Unknown"}</span></span>
            <span>ID: <span className="text-foreground/80">{run.id.split('-')[0]}</span></span>
          </div>
        </div>

        {/* Global Stats Panel */}
        <div className="flex gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="space-y-1">
            <div className="text-micro text-muted/80 font-semibold">Execution time</div>
            <div className="text-sm font-mono-data font-bold text-foreground/80">{run.total_duration_ms || 0}ms</div>
          </div>
          <div className="w-px bg-white/10 mx-1"></div>
          <div className="space-y-1">
            <div className="text-micro text-muted/80 font-semibold">Total tokens</div>
            <div className="text-sm font-mono-data font-bold text-accent/80">{run.total_tokens || 0}</div>
          </div>
          <div className="w-px bg-white/10 mx-1"></div>
          <div className="space-y-1 pr-2">
            <div className="text-micro text-muted/80 font-semibold">Run cost</div>
            <div className="text-sm font-mono-data font-bold text-foreground/80">₹{(run.total_cost || 0).toFixed(6)}</div>
          </div>
          {run.is_optimized && (
            <>
              <div className="w-px bg-white/10 mx-1"></div>
              <div className="space-y-1 pr-2">
                <div className="text-micro text-success font-semibold flex items-center gap-1">
                  <Zap className="w-2 h-2" /> Optimized
                </div>
                <div className="text-sm font-mono-data font-bold text-success/80">-{run.tokens_saved || 0} <span className="text-xs">Saved</span></div>
              </div>
            </>
          )}
        </div>
      </header>

      <TraceDetailContent run={run} logs={logs || []} />
    </div>
  );
}
