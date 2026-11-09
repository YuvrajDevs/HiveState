"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Cpu, Eye, Code, CheckCircle2, AlertOctagon, Loader2, RotateCw, AlertTriangle, Layers, UserCheck } from "lucide-react";
import { getModel } from "@/lib/models/catalog";

type AgentData = {
  label?: string;
  model?: string;
  systemPrompt?: string;
  is_hitl?: boolean | string;
  retries?: number;
  status?: string;
  pause_reason?: string;
  runId?: string;
  executionLog?: { status?: string; input?: string; output?: string; attempts?: number; is_skipped?: boolean };
  onInspect?: (type: "input" | "output") => void;
  onRetry?: () => void;
};

const STATUS_TEXT: Record<string, string> = {
  running: "Running", success: "Done", failed: "Failed", paused_hitl: "Review", paused_error: "Paused", idle: "Waiting",
};

export default function AgentNode({ data: raw, selected }: NodeProps) {
  const data = raw as AgentData;
  const status = data.status;
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isFailed = status === "failed" || status === "paused_error";
  const isReview = status === "paused_hitl";
  const isBreaker = data.pause_reason === "circuit_breaker";
  const isMultiInput = data.executionLog?.input?.startsWith('{"inputs":');
  const streaming = isRunning ? data.executionLog?.output : null;
  const modelLabel = getModel(data.model)?.label || data.model || "Default model";
  const reviewFirst = data.is_hitl === true || data.is_hitl === "true";

  const border = isBreaker
    ? "border-red-500 ring-2 ring-red-500/60"
    : isRunning
      ? "border-accent ring-2 ring-accent/60"
      : isSuccess
        ? "border-green-500/50"
        : isFailed
          ? "border-red-500/50"
          : isReview
            ? "border-yellow-500/60 ring-1 ring-yellow-500/40"
            : selected
              ? "border-accent/60 ring-1 ring-accent/40"
              : "border-white/10";

  return (
    <div className={`w-[280px] overflow-hidden rounded-md border bg-[#141414] transition-colors ${border}`} aria-label={`Agent ${data.label || ""}${status ? `, ${STATUS_TEXT[status] || status}` : ""}`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-none !bg-accent" />

      <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${isSuccess ? "border-green-500/10 bg-green-500/5" : isFailed ? "border-red-500/10 bg-red-500/5" : isRunning ? "border-accent/10 bg-accent/5" : "border-white/5 bg-white/[0.03]"}`}>
        <div className="flex min-w-0 items-center gap-2">
          {isBreaker ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" /> : isRunning ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" /> : <Cpu className={`h-3.5 w-3.5 shrink-0 ${isSuccess ? "text-green-500" : isFailed ? "text-red-500" : "text-accent"}`} />}
          <span className="truncate text-xs font-semibold text-neutral-100">{data.label || "New agent"}</span>
        </div>
        {status && (
          <span className={`flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSuccess ? "border-green-500/30 text-green-400" : isFailed ? "border-red-500/30 text-red-400" : isRunning ? "border-accent/30 text-accent" : isReview ? "border-yellow-500/30 text-yellow-400" : "border-white/10 text-neutral-400"}`}>
            {isSuccess && <CheckCircle2 className="h-2.5 w-2.5" />}
            {isFailed && <AlertOctagon className="h-2.5 w-2.5" />}
            {isBreaker ? "Halted" : STATUS_TEXT[status] || status}
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono-data text-[10px] text-neutral-300">{modelLabel}</span>
          {reviewFirst && <span className="flex items-center gap-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-400"><UserCheck className="h-2.5 w-2.5" /> review first</span>}
          {isMultiInput && <span className="flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent"><Layers className="h-2.5 w-2.5" /> merges inputs</span>}
          {(data.executionLog?.attempts || 1) > 1 && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">{data.executionLog?.attempts} attempts</span>}
          {data.executionLog?.is_skipped && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">reused</span>}
        </div>

        {streaming ? (
          <p className="line-clamp-4 whitespace-pre-wrap break-words font-mono-data text-[11px] leading-relaxed text-neutral-200" aria-live="polite">
            {streaming.slice(-280)}
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />
          </p>
        ) : (
          <p className="line-clamp-3 break-words font-mono-data text-[11px] leading-relaxed text-neutral-400">{data.systemPrompt || "No instructions yet. Select this step to write them."}</p>
        )}

        {(data.executionLog || isRunning) && (
          <div className="flex gap-1.5 pt-1">
            <button onClick={(e) => { e.stopPropagation(); data.onInspect?.("input"); }} className="nodrag flex flex-1 items-center justify-center gap-1 rounded border border-white/10 py-1 text-[10px] text-neutral-300 hover:bg-white/5">
              <Code className="h-3 w-3" /> Input
            </button>
            <button onClick={(e) => { e.stopPropagation(); data.onInspect?.("output"); }} className="nodrag flex flex-1 items-center justify-center gap-1 rounded border border-white/10 py-1 text-[10px] text-neutral-300 hover:bg-white/5">
              <Eye className="h-3 w-3" /> Output
            </button>
          </div>
        )}

        {isFailed && data.runId && (
          <div className="flex gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); data.onRetry?.(); }} className="nodrag flex flex-1 items-center justify-center gap-1 rounded border border-accent/30 bg-accent/10 py-1 text-[10px] font-semibold text-accent hover:bg-accent/20">
              <RotateCw className="h-3 w-3" /> Retry
            </button>
            <a href={`/tasks/${data.runId}`} onClick={(e) => e.stopPropagation()} className="nodrag flex flex-1 items-center justify-center rounded border border-red-500/20 py-1 text-[10px] text-red-300 hover:bg-red-500/10">
              Open trace
            </a>
          </div>
        )}
        {isReview && data.runId && (
          <a href={`/tasks/${data.runId}`} onClick={(e) => e.stopPropagation()} className="nodrag block rounded border border-yellow-500/30 bg-yellow-500/10 py-1 text-center text-[10px] font-semibold text-yellow-300 hover:bg-yellow-500/20">
            Review and approve
          </a>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className={`!h-2 !w-2 !border-none ${isSuccess ? "!bg-green-500" : "!bg-accent/50"}`} />
    </div>
  );
}
