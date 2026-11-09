import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

// Shared runs may contain private data: keep them out of search engines.
export const metadata: Metadata = { title: "Shared run · HiveState", robots: { index: false, follow: false } };

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Read-only view of one run, reached by an unguessable token. Only this run's steps are exposed;
 * there are no actions, and revoking the token on the run page makes this URL 404 immediately.
 */
export default async function SharedRunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { data: run } = await supabaseAdmin
    .from("runs")
    .select("id, status, pause_reason, input_prompt, started_at, completed_at, total_cost, total_tokens, total_duration_ms, workflow:workflows(name)")
    .eq("share_token", token)
    .maybeSingle();
  if (!run) notFound();

  const { data: logs } = await supabaseAdmin
    .from("logs")
    .select("id, node_name, status, input, output, error, model_used, total_tokens, duration_ms")
    .eq("run_id", run.id)
    .in("status", ["success", "failed", "paused_hitl"])
    .order("created_at", { ascending: true });

  const name = (run.workflow as { name?: string } | null)?.name || "Workflow run";
  const steps = (logs || []).filter((l) => !String(l.node_name || "").startsWith("Context summary"));

  return (
    <article className="mx-auto max-w-3xl space-y-6 py-4">
      <header className="space-y-2 border-b border-white/5 pb-4">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Shared run · read-only</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <StatusBadge status={run.status} pauseReason={run.pause_reason} />
        </div>
        <p className="font-mono-data text-xs text-neutral-500">
          {new Date(run.started_at).toUTCString()} · {steps.length} steps · {Number(run.total_tokens || 0).toLocaleString()} tokens · ₹{Number(run.total_cost || 0).toFixed(4)}
        </p>
      </header>

      <section aria-labelledby="input-h" className="space-y-2">
        <h2 id="input-h" className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Input</h2>
        <pre className="whitespace-pre-wrap break-words rounded-md border border-white/5 bg-black/40 p-3 font-mono-data text-xs text-neutral-200">{run.input_prompt}</pre>
      </section>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.id} className="rounded-md border border-white/5 bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{i + 1}. {s.node_name}</h3>
              <span className="font-mono-data text-[11px] text-neutral-500">
                {s.model_used || "review"} · {s.total_tokens || 0} tokens · {((s.duration_ms || 0) / 1000).toFixed(1)}s
              </span>
            </div>
            {s.status === "failed" ? (
              <p className="font-mono-data text-xs text-red-300">{s.error}</p>
            ) : s.status === "paused_hitl" ? (
              <p className="text-xs text-yellow-300">Waiting for human review.</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono-data text-xs leading-relaxed text-neutral-200">{s.output || s.input}</pre>
            )}
          </li>
        ))}
      </ol>

      <footer className="border-t border-white/5 pt-4 text-[11px] text-neutral-500">Built with HiveState, a visual multi-agent workflow runner.</footer>
    </article>
  );
}
