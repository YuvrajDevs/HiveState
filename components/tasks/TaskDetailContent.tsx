"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, CheckCircle2, AlertOctagon, Loader2, Clock, Coins, Copy, Check, Link2, Link2Off, RotateCw, Search, Square, Workflow,
  PauseCircle, Play, CornerDownRight, Repeat,
} from "lucide-react";
import { resumeTask, approveTask, rejectTask, stopTask, rerunTask } from "@/app/actions/tasks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Highlight } from "@/components/ui/Highlight";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from Supabase selects */

const ACTIVE = ["queued", "running", "resumed"];
const inr = (n: number) => `₹${Number(n || 0).toFixed(Number(n) < 0.01 ? 5 : 3)}`;

function StepIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-label="succeeded" />;
  if (status === "failed") return <AlertOctagon className="h-3.5 w-3.5 text-red-500" aria-label="failed" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-label="running" />;
  return <PauseCircle className="h-3.5 w-3.5 text-yellow-500" aria-label="waiting" />;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white"
      aria-label={label}
    >
      {done ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />} {done ? "Copied" : label}
    </button>
  );
}

function Block({ title, text, query, tone = "", action }: { title: string; text?: string | null; query: string; tone?: string; action?: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
        <div className="flex items-center gap-1">{action}{text ? <CopyButton text={text} /> : null}</div>
      </div>
      <pre className={`max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/5 bg-black/50 p-3 font-mono-data text-xs leading-relaxed ${tone || "text-neutral-200"}`}>
        {text ? <Highlight text={text} query={query} /> : <span className="text-neutral-500">Nothing recorded.</span>}
      </pre>
    </section>
  );
}

export default function TaskDetailContent({ initialRun, initialLogs }: { initialRun: any; initialLogs: any[] }) {
  const router = useRouter();
  const [run, setRun] = useState<any>(initialRun);
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [selectedId, setSelectedId] = useState<string | null>(initialLogs.at(-1)?.id ?? null);
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [editedInput, setEditedInput] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);

  const active = ACTIVE.includes(run.status);
  const canvasNodes: any[] = run.workflow?.canvas_json?.nodes || [];
  const totalSteps = canvasNodes.length;
  const doneSteps = new Set(logs.filter((l) => l.status === "success" && !String(l.node_id).startsWith("__")).map((l) => l.node_id)).size;
  const progress = run.status === "completed" ? 100 : totalSteps ? Math.min(100, Math.round((doneSteps / totalSteps) * 100)) : 0;

  // Poll while the run is active. Streaming output lands in the step rows, so a short interval shows it live.
  useEffect(() => {
    if (!ACTIVE.includes(run.status) && pollKey === 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const [r, l] = await Promise.all([fetch(`/api/tasks/${run.id}`, { cache: "no-store" }), fetch(`/api/tasks/${run.id}/logs`, { cache: "no-store" })]);
        if (alive && r.ok && l.ok) {
          const next = (await r.json()).run;
          setRun(next);
          setLogs((await l.json()).logs || []);
          if (!ACTIVE.includes(next.status)) return;
        }
      } catch {
        /* keep polling through brief network errors */
      }
      if (alive) timer = setTimeout(tick, 1000);
    };
    timer = setTimeout(tick, 600);
    return () => { alive = false; clearTimeout(timer); };
  }, [run.id, run.status, pollKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => [l.node_name, l.input, l.output, l.error, l.system_prompt].some((f) => String(f || "").toLowerCase().includes(q)));
  }, [logs, query]);

  // Follow the newest step while running, unless the user picked one.
  const selected = (follow && active ? logs.at(-1) : logs.find((l) => l.id === selectedId)) || filtered[0] || null;
  const pausedLog = [...logs].reverse().find((l) => l.node_id === run.paused_node_id);

  const act = useCallback(
    async (key: string, fn: () => Promise<{ success: boolean; error?: string; runId?: string }>, ok: string) => {
      setBusy(key);
      setMessage(null);
      const res = await fn();
      setBusy(null);
      if (!res.success) return setMessage({ tone: "error", text: res.error || "Something went wrong" });
      setMessage({ tone: "ok", text: ok });
      return res;
    },
    [],
  );

  const resumeHere = async (fn: () => Promise<any>, ok: string) => {
    const res = await act("resume", fn, ok);
    if (res) {
      setRun((r: any) => ({ ...r, status: "queued" }));
      setFollow(true);
      setPollKey((k) => k + 1);
    }
  };

  const rerun = async (fromNodeId?: string) => {
    const res = await act(fromNodeId ? `rerun-${fromNodeId}` : "rerun", () => rerunTask(run.id, fromNodeId), "New run queued");
    if (res?.runId) router.push(`/tasks/${res.runId}`);
  };

  const share = async (on: boolean) => {
    setBusy("share");
    const res = await fetch(`/api/runs/${run.id}/share`, { method: on ? "POST" : "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMessage({ tone: "error", text: data.error || "Could not update the link" });
    setRun((r: any) => ({ ...r, share_token: on ? data.token : null }));
    if (on) {
      navigator.clipboard?.writeText(`${location.origin}/share/${data.token}`).catch(() => undefined);
      setMessage({ tone: "ok", text: "Read-only link copied. Anyone with it can view this run." });
    } else setMessage({ tone: "ok", text: "Link revoked." });
  };

  const shareUrl = run.share_token && typeof window !== "undefined" ? `${window.location.origin}/share/${run.share_token}` : null;
  const vars = Object.entries(run.variables || {});
  const btn = "flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-white/5 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white"><ArrowLeft className="h-3 w-3" /> Run history</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight">{run.workflow?.name || "Deleted workflow"}</h1>
            <StatusBadge status={run.status} pauseReason={run.pause_reason} />
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono-data text-[11px] text-neutral-500">
            <span>run {run.id.slice(0, 8)}</span>
            {run.workflow_version && <span>workflow v{run.workflow_version}</span>}
            <span suppressHydrationWarning>started {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</span>
            {run.parent_run_id && (
              <Link href={`/tasks/${run.parent_run_id}`} className="text-accent hover:underline">
                re-run of {run.parent_run_id.slice(0, 8)}{run.rerun_from_node_id ? " from a step" : ""}
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {run.workflow_id && <Link href={`/workflows/${run.workflow_id}?runId=${run.id}`} className={btn}><Workflow className="h-3.5 w-3.5" /> Canvas</Link>}
          {active || run.status.startsWith("paused") ? (
            <button className={btn} disabled={busy === "stop"} onClick={() => confirm("Stop this run? Finished steps are kept.") && act("stop", () => stopTask(run.id), "Run stopped").then(() => setRun((r: any) => ({ ...r, status: "stopped" })))}>
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : null}
          {run.workflow_id && (
            <button className={btn} disabled={!!busy} onClick={() => rerun()} title="Start a new run with the same input and variables">
              {busy === "rerun" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />} Re-run
            </button>
          )}
          {run.share_token ? (
            <>
              {shareUrl && <CopyButton text={shareUrl} label="Copy link" />}
              <button className={btn} disabled={busy === "share"} onClick={() => share(false)}><Link2Off className="h-3.5 w-3.5" /> Revoke link</button>
            </>
          ) : (
            <button className={btn} disabled={busy === "share"} onClick={() => share(true)} title="Create a read-only link to this run"><Link2 className="h-3.5 w-3.5" /> Share</button>
          )}
        </div>
      </header>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-xs ${message.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-green-500/30 bg-green-500/10 text-green-200"}`}>
          {message.text}
        </p>
      )}

      {/* Metrics */}
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Progress", `${progress}% · ${doneSteps}/${totalSteps} steps`],
          ["Cost", inr(run.total_cost)],
          ["Tokens", Number(run.total_tokens || 0).toLocaleString()],
          ["Model time", run.total_duration_ms ? `${(run.total_duration_ms / 1000).toFixed(1)} s` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-white/5 bg-white/[0.02] p-3">
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500">{k}</dt>
            <dd className="mt-0.5 font-mono-data text-sm font-semibold text-neutral-100">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="h-1 overflow-hidden rounded bg-white/5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress">
        <div className={`h-full transition-all ${["failed", "paused_error"].includes(run.status) ? "bg-red-500" : run.status === "completed" ? "bg-green-500" : "bg-accent"}`} style={{ width: `${progress}%` }} />
      </div>

      {/* Needs a human */}
      {run.status === "paused_hitl" && (
        <section className="rounded-md border border-yellow-500/30 bg-yellow-500/[0.06] p-4" aria-labelledby="review-title">
          <h2 id="review-title" className="text-sm font-semibold text-yellow-100">Review needed: {pausedLog?.node_name || "review step"}</h2>
          <p className="mt-1 text-xs text-yellow-100/70">
            {canvasNodes.find((n) => n.id === run.paused_node_id)?.data?.instructions || "Check the output below. Approve to continue, optionally with a note for the next step, or reject to stop the run."}
          </p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note passed to the next step (required to reject)" className="mt-3 w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60" aria-label="Reviewer note" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={!!busy} onClick={() => resumeHere(() => approveTask(run.id, run.paused_node_id, note), "Approved. Continuing the run.")} className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {busy === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve and continue
            </button>
            <button disabled={!!busy || !note.trim()} onClick={() => act("reject", () => rejectTask(run.id, run.paused_node_id, note), "Rejected. The run was stopped.").then(() => setRun((r: any) => ({ ...r, status: "stopped" })))} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-40" title={note.trim() ? "" : "Add a note to reject"}>
              Reject
            </button>
          </div>
        </section>
      )}

      {run.status === "paused_error" && (
        <section className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-4" aria-labelledby="err-title">
          <h2 id="err-title" className="text-sm font-semibold text-red-100">
            {run.pause_reason === "circuit_breaker" ? `Halted after ${run.consecutive_failures_count} failures in a row` : run.pause_reason === "budget_limit" ? "Paused: daily budget reached" : `Paused: ${pausedLog?.node_name || "a step"} failed`}
          </h2>
          <p className="mt-1 break-words font-mono-data text-xs text-red-100/80">{run.error || pausedLog?.error}</p>
          {run.pause_reason === "budget_limit" ? (
            <p className="mt-2 text-xs text-red-100/80">Raise the limit in <Link href="/settings" className="underline">Settings</Link>, then retry.</p>
          ) : pausedLog ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-red-100/80">Edit this step&apos;s input before retrying</summary>
              <textarea value={editedInput ?? pausedLog.input ?? ""} onChange={(e) => setEditedInput(e.target.value)} rows={6} aria-label="Step input" className="mt-2 w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono-data text-xs outline-none focus-visible:ring-2 focus-visible:ring-red-400/60" />
            </details>
          ) : null}
          <button
            disabled={!!busy}
            onClick={() => resumeHere(() => resumeTask(run.id, editedInput !== null ? run.paused_node_id : undefined, editedInput ?? undefined), "Retrying. Finished steps are reused.")}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />} {run.circuit_breaker_triggered ? "Reset and retry" : "Retry failed step"}
          </button>
        </section>
      )}

      {run.status === "failed" && run.error && (
        <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-3 font-mono-data text-xs text-red-200">{run.error}</p>
      )}

      {/* Timeline + step detail */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex max-h-72 flex-col rounded-md border border-white/5 bg-surface lg:max-h-none lg:w-80 lg:shrink-0" aria-label="Steps">
          <div className="border-b border-white/5 p-2">
            <label className="relative block">
              <span className="sr-only">Search steps</span>
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inputs, outputs, errors…" className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
            </label>
            {query && <p className="mt-1 px-1 text-[11px] text-neutral-500">{filtered.length} of {logs.length} steps match</p>}
          </div>
          <ol className="flex-1 overflow-y-auto p-2">
            {logs.length === 0 && (
              <li className="flex items-center justify-center gap-2 py-10 text-xs text-neutral-500">
                {active ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {run.status === "queued" ? "Waiting for a worker…" : "Starting…"}</> : "No steps recorded."}
              </li>
            )}
            {filtered.map((l, i) => {
              const isSel = selected?.id === l.id;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => { setSelectedId(l.id); setFollow(false); }}
                    aria-current={isSel ? "step" : undefined}
                    className={`mb-1 flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left ${isSel ? "border-accent/30 bg-accent/10" : "border-transparent hover:bg-white/[0.03]"}`}
                  >
                    <span className="mt-0.5"><StepIcon status={l.status} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-100">{l.node_name || l.node_id}</span>
                      <span className="block font-mono-data text-[11px] text-neutral-500">
                        #{logs.indexOf(l) + 1 || i + 1} · {l.status === "running" ? "streaming…" : `${((l.duration_ms || 0) / 1000).toFixed(1)}s · ${inr(l.step_cost)}`}
                        {l.attempts > 1 && ` · ${l.attempts} tries`}
                        {l.is_skipped && " · reused"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="min-h-0 flex-1 overflow-y-auto rounded-md border border-white/5 bg-surface p-4" aria-label="Step detail">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><StepIcon status={selected.status} /> {selected.node_name || selected.node_id}</h2>
                  <p className="mt-1 flex flex-wrap gap-x-3 font-mono-data text-[11px] text-neutral-500">
                    {selected.model_used && <span>{selected.model_used}{selected.fallback_triggered && " (fallback)"}</span>}
                    <span>{selected.prompt_tokens || 0} in / {selected.completion_tokens || 0} out</span>
                    <span>{inr(selected.step_cost)}</span>
                    <span><Clock className="mr-0.5 inline h-3 w-3" />{((selected.duration_ms || 0) / 1000).toFixed(2)}s</span>
                    {selected.attempts > 1 && <span>{selected.attempts} attempts</span>}
                    {selected.skip_reason && <span>{selected.skip_reason === "hitl_gate" ? "review step" : selected.skip_reason}</span>}
                  </p>
                </div>
                {run.workflow_id && !active && canvasNodes.some((n) => n.id === selected.node_id) && (
                  <button className={btn} disabled={!!busy} onClick={() => rerun(selected.node_id)} title="New run that reuses earlier steps and re-runs this one and everything after it">
                    {busy === `rerun-${selected.node_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownRight className="h-3.5 w-3.5" />} Re-run from here
                  </button>
                )}
              </div>
              {selected.error && <Block title="Error" text={`${selected.error_code ? `[${selected.error_code}] ` : ""}${selected.error}`} query={query} tone="text-red-300" />}
              {selected.correction_note && <Block title="Reviewer note" text={selected.correction_note} query={query} tone="text-yellow-200" />}
              <Block title={selected.status === "running" ? "Output (streaming)" : "Output"} text={selected.output} query={query} tone="text-green-100" />
              <Block title="Input" text={selected.input} query={query} />
              <Block title="System prompt" text={selected.system_prompt} query={query} tone="text-neutral-400" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-xs text-neutral-500">
              {query ? "No step matches your search." : active ? <><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the first step…</> : "Select a step to inspect it."}
            </div>
          )}

          <details className="mt-6 border-t border-white/5 pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-400">Run input{vars.length ? ` and ${vars.length} variable${vars.length === 1 ? "" : "s"}` : ""}</summary>
            <div className="mt-3 space-y-3">
              {vars.length > 0 && (
                <dl className="grid gap-1 font-mono-data text-xs sm:grid-cols-2">
                  {vars.map(([k, v]) => (
                    <div key={k} className="truncate"><dt className="inline text-neutral-500">{`{{${k}}}`} = </dt><dd className="inline text-neutral-200">{String(v)}</dd></div>
                  ))}
                </dl>
              )}
              <Block title="Input" text={run.input_prompt} query={query} />
            </div>
          </details>
        </section>
      </div>

      {run.status === "completed" && (
        <p className="flex items-center gap-2 text-xs text-neutral-500"><Play className="h-3 w-3" /> Finished. Use “Re-run from here” on any step to iterate on part of the workflow without paying for the steps before it.</p>
      )}
    </div>
  );
}
