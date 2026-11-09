"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Search, Trash2, Loader2, Activity, Repeat, Square, AlertTriangle, X } from "lucide-react";
import { clearCompletedTasks, stopTask, rerunTask } from "@/app/actions/tasks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from a Supabase select */

const STATUS_GROUPS: Record<string, { label: string; statuses: string[] | null }> = {
  all: { label: "All statuses", statuses: null },
  active: { label: "Queued or running", statuses: ["queued", "running", "resumed"] },
  attention: { label: "Needs attention", statuses: ["paused_hitl", "paused_error"] },
  completed: { label: "Completed", statuses: ["completed"] },
  failed: { label: "Failed or stopped", statuses: ["failed", "stopped", "aborted"] },
};
const RANGES: Record<string, { label: string; ms: number | null }> = {
  all: { label: "Any time", ms: null },
  "24h": { label: "Last 24 hours", ms: 864e5 },
  "7d": { label: "Last 7 days", ms: 7 * 864e5 },
  "30d": { label: "Last 30 days", ms: 30 * 864e5 },
};
const ACTIVE = ["queued", "running", "resumed"];

/** Run history with filters kept in the URL, so a filtered view can be bookmarked or shared. */
export default function TasksContent({ initialTasks, workflows }: { initialTasks: any[]; workflows: any[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState(params.get("q") || "");

  const status = STATUS_GROUPS[params.get("status") || ""] ? params.get("status")! : "all";
  const range = RANGES[params.get("range") || ""] ? params.get("range")! : "all";
  const workflow = params.get("workflow") || "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const group = STATUS_GROUPS[status].statuses;
    const since = RANGES[range].ms ? now - RANGES[range].ms! : null;
    return initialTasks.filter((t) => {
      if (group && !group.includes(t.status)) return false;
      if (workflow !== "all" && t.workflow_id !== workflow) return false;
      if (since && new Date(t.started_at).getTime() < since) return false;
      if (needle && !`${t.workflow?.name || ""} ${t.id} ${t.error || ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [initialTasks, q, status, range, workflow, now]);

  const totals = useMemo(() => filtered.reduce((a, t) => ({ cost: a.cost + Number(t.total_cost || 0), tokens: a.tokens + (t.total_tokens || 0) }), { cost: 0, tokens: 0 }), [filtered]);
  const breakers = initialTasks.filter((t) => t.circuit_breaker_triggered && t.status === "paused_error");
  const filtersOn = q || status !== "all" || range !== "all" || workflow !== "all";

  const clear = async () => {
    if (!confirm("Delete all completed, failed and stopped runs? This cannot be undone.")) return;
    setBusy("clear");
    const res = await clearCompletedTasks();
    setBusy(null);
    if (!res.success) alert(`Could not clear runs: ${res.error}`);
    router.refresh();
  };

  const rerun = async (id: string) => {
    setBusy(`rerun-${id}`);
    const res = await rerunTask(id);
    setBusy(null);
    if (res.success && res.runId) router.push(`/tasks/${res.runId}`);
    else if (!res.success) alert(res.error);
  };

  const stop = async (id: string) => {
    if (!confirm("Stop this run? Finished steps are kept.")) return;
    setBusy(`stop-${id}`);
    await stopTask(id);
    setBusy(null);
    router.refresh();
  };

  const control = "rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {breakers.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <span className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" /> {breakers.length} run{breakers.length === 1 ? " was" : "s were"} halted after repeated failures.</span>
          <Link href={`/tasks/${breakers[0].id}`} className="font-semibold underline">Resolve</Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="search">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search runs</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParam("q", q)} onKeyDown={(e) => e.key === "Enter" && setParam("q", q)} placeholder="Search by workflow, run id or error" className={`${control} w-full pl-8`} />
        </label>
        <select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value)} className={control}>
          {Object.entries(STATUS_GROUPS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Workflow" value={workflow} onChange={(e) => setParam("workflow", e.target.value)} className={`${control} max-w-[200px]`}>
          <option value="all">All workflows</option>
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select aria-label="Time range" value={range} onChange={(e) => setParam("range", e.target.value)} className={control}>
          {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {filtersOn && (
          <button onClick={() => { setQ(""); startTransition(() => router.replace(pathname)); }} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-white">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
        <button onClick={clear} disabled={busy === "clear" || initialTasks.length === 0} className="ml-auto flex items-center gap-1.5 rounded-md border border-red-500/20 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40">
          {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Clear finished
        </button>
      </div>

      <p className="font-mono-data text-[11px] text-neutral-500" aria-live="polite">
        {pending ? "Filtering…" : `${filtered.length} run${filtered.length === 1 ? "" : "s"} · ₹${totals.cost.toFixed(3)} · ${totals.tokens.toLocaleString()} tokens`}
      </p>

      {filtered.length === 0 ? (
        initialTasks.length === 0 ? (
          <EmptyState icon={Activity} title="No runs yet" message="Runs appear here as soon as you start one. Each keeps its steps, cost and output." action={<Link href="/run" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">Run a workflow</Link>} />
        ) : (
          <EmptyState icon={Search} title="No runs match these filters" message="Try a wider time range or a different status." />
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/5 bg-surface">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#171717] text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Workflow</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">Cost</th>
                <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">Time</th>
                <th scope="col" className="px-3 py-2 font-semibold">Started</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02]">
                  <td className="max-w-[240px] px-3 py-2.5">
                    <Link href={`/tasks/${t.id}`} className="block truncate font-semibold text-neutral-100 hover:text-accent focus-visible:underline">
                      {t.workflow?.name || "Deleted workflow"}
                    </Link>
                    <span className="font-mono-data text-[11px] text-neutral-500">{t.id.slice(0, 8)}{t.parent_run_id && " · re-run"}</span>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={t.status} pauseReason={t.pause_reason} /></td>
                  <td className="hidden px-3 py-2.5 font-mono-data text-neutral-300 md:table-cell">
                    ₹{Number(t.total_cost || 0).toFixed(4)}<span className="block text-[11px] text-neutral-500">{(t.total_tokens || 0).toLocaleString()} tok</span>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono-data text-neutral-400 lg:table-cell">{t.total_duration_ms ? `${(t.total_duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-neutral-400" suppressHydrationWarning>{formatDistanceToNow(new Date(t.started_at), { addSuffix: true })}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {ACTIVE.includes(t.status) ? (
                        <button onClick={() => stop(t.id)} disabled={busy === `stop-${t.id}`} className="rounded p-1.5 text-neutral-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Stop run ${t.id.slice(0, 8)}`} title="Stop">
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      ) : t.workflow_id ? (
                        <button onClick={() => rerun(t.id)} disabled={!!busy} className="rounded p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label={`Re-run ${t.id.slice(0, 8)}`} title="Re-run with the same input">
                          {busy === `rerun-${t.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
