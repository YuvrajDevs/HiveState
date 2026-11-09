"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, Play, Upload, X, Coins } from "lucide-react";
import { workflowVariables, extractVariables } from "@/lib/engine/template";
import type { Canvas } from "@/lib/engine/types";

export interface RunFormWorkflow {
  id: string;
  name: string;
  canvas_json: Canvas | null;
}

interface EstimateResponse {
  estimate: { expected: number; low: number; high: number; inputTokens: number; outputTokens: number; nodes: Array<{ nodeId: string; label: string; model: string; cost: number }> };
  budget: { limit: number; spent: number; remaining: number | null; wouldExceed: boolean };
}

const inr = (n: number) => (n < 0.01 ? `₹${n.toFixed(4)}` : `₹${n.toFixed(2)}`);

/**
 * Starts a run: input (typed, pasted or from a file), a field per {{variable}} the workflow uses,
 * and a live cost estimate against today's budget. Shared by the Run page and the canvas.
 */
export function RunForm({
  workflows,
  initialWorkflowId,
  onStarted,
  autoFocus,
}: {
  workflows: RunFormWorkflow[];
  initialWorkflowId?: string | null;
  onStarted: (runId: string, workflowId: string) => void;
  autoFocus?: boolean;
}) {
  const ids = useId();
  const [workflowId, setWorkflowId] = useState(initialWorkflowId || workflows[0]?.id || "");
  const [input, setInput] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workflowId && workflows[0]) setWorkflowId(initialWorkflowId || workflows[0].id);
  }, [workflows, workflowId, initialWorkflowId]);

  const workflow = workflows.find((w) => w.id === workflowId);
  const nodeCount = workflow?.canvas_json?.nodes?.length || 0;
  const variables = useMemo(() => {
    const names = new Set([...workflowVariables(workflow?.canvas_json), ...extractVariables(input)]);
    return [...names];
  }, [workflow, input]);
  const missing = variables.filter((v) => !vars[v]?.trim());

  // Debounced estimate: cheap, but no need to call on every keystroke.
  useEffect(() => {
    if (!workflowId || nodeCount === 0) {
      setEstimate(null);
      return;
    }
    setEstimating(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, input, variables: vars }),
          signal: ctrl.signal,
        });
        if (res.ok) setEstimate(await res.json());
      } catch {
        /* aborted or offline: keep the last estimate */
      } finally {
        if (!ctrl.signal.aborted) setEstimating(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [workflowId, input, vars, nodeCount]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/parse-file", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not read the file");
      setInput(data.text);
      setFile({ name: f.name, size: f.size });
    } catch (e) {
      setError(`Could not read ${f.name}: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const canRun = !!workflowId && nodeCount > 0 && input.trim().length > 0 && missing.length === 0 && !submitting && !uploading;

  const submit = useCallback(async () => {
    if (!canRun) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, input, variables: Object.fromEntries(variables.map((v) => [v, vars[v] || ""])) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      onStarted(data.runId, workflowId);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }, [canRun, workflowId, input, variables, vars, onStarted]);

  const reason = !workflowId
    ? "Choose a workflow."
    : nodeCount === 0
      ? "This workflow has no steps yet. Open it in the editor and add an agent."
      : !input.trim()
        ? "Add some input: type, paste, or attach a file."
        : missing.length
          ? `Fill in ${missing.map((m) => `{{${m}}}`).join(", ")}.`
          : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
    >
      {workflows.length > 1 || !initialWorkflowId ? (
        <div className="space-y-1.5">
          <label htmlFor={`${ids}-wf`} className="text-xs font-semibold text-neutral-300">Workflow</label>
          <select
            id={`${ids}-wf`}
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {workflows.length === 0 && <option value="">No workflows yet</option>}
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.canvas_json?.nodes?.length || 0} steps)
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`${ids}-input`} className="text-xs font-semibold text-neutral-300">Input</label>
          {file ? (
            <span className="flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
              <FileText className="h-3 w-3" /> {file.name} · {(file.size / 1024).toFixed(1)} KB
              <button type="button" onClick={() => { setFile(null); setInput(""); }} aria-label="Remove file" className="rounded p-0.5 hover:bg-accent/20">
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || submitting}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Attach PDF, Markdown or text
            </button>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.md,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-hidden tabIndex={-1} />
        </div>
        <textarea
          id={`${ids}-input`}
          autoFocus={autoFocus}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
          rows={6}
          placeholder="What should the workflow work on? You can use {{variables}} here too."
          className="w-full resize-y rounded-md border border-white/10 bg-white/[0.03] p-3 font-mono-data text-xs leading-relaxed outline-none placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>

      {variables.length > 0 && (
        <fieldset className="space-y-2 rounded-md border border-white/10 p-3">
          <legend className="px-1 text-xs font-semibold text-neutral-300">Variables</legend>
          <p className="text-[11px] text-neutral-400">Values for the <code className="font-mono-data">{"{{placeholders}}"}</code> used in this workflow&apos;s prompts.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {variables.map((v) => (
              <label key={v} className="space-y-1">
                <span className="font-mono-data text-[11px] text-neutral-400">{`{{${v}}}`}</span>
                <input
                  value={vars[v] || ""}
                  onChange={(e) => setVars((p) => ({ ...p, [v]: e.target.value }))}
                  aria-invalid={!vars[v]?.trim()}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {estimate && nodeCount > 0 && (
        <div
          className={`rounded-md border p-3 text-xs ${estimate.budget.wouldExceed ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-100" : "border-white/10 bg-white/[0.02] text-neutral-300"}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold">
              <Coins className="h-3.5 w-3.5" /> Estimated cost {inr(estimate.estimate.low)} – {inr(estimate.estimate.high)}
              {estimating && <Loader2 className="h-3 w-3 animate-spin opacity-60" />}
            </span>
            <span className="font-mono-data text-[11px] text-neutral-400">
              ~{estimate.estimate.inputTokens.toLocaleString()} in / {estimate.estimate.outputTokens.toLocaleString()} out tokens
            </span>
          </div>
          {estimate.budget.limit > 0 && (
            <p className="mt-1 text-[11px] text-neutral-400">
              Today: {inr(estimate.budget.spent)} of {inr(estimate.budget.limit)} used.
              {estimate.budget.wouldExceed && " This run may hit the daily limit; it will pause rather than overspend."}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-neutral-400" role="status">{reason || "Ready. Press Ctrl/⌘ + Enter to run."}</p>
        <button
          type="submit"
          disabled={!canRun}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          {submitting ? "Queuing…" : "Run workflow"}
        </button>
      </div>
    </form>
  );
}
