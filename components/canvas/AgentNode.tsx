"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeData } from "@/types/domain";
import { Terminal, Cpu, Eye, Code, CheckCircle2, AlertOctagon, Loader2, Zap, AlertTriangle, Layers } from "lucide-react";

export default function AgentNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const isRunning = data.status === "running" || data.status === "resumed";
  const isSuccess = data.status === "success";
  const isFailed = data.status === "failed";
  const isPaused = data.status === "paused" || data.status === "paused_hitl" || data.status === "paused_error";
  const isCircuitBreaker = data.pause_reason === "circuit_breaker";
  const isMultiInput = data.executionLog?.input?.startsWith('{"inputs":');

  return (
    <div className={`modern-card w-[280px] transition-all duration-500 overflow-hidden rounded-xl border group ${
      isCircuitBreaker ? "ring-4 ring-danger shadow-[0_0_50px_rgba(239,68,68,0.4)] border-danger animate-pulse-slow bg-danger/20" :
      isRunning ? "ring-2 ring-accent border-accent" :
      isSuccess ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
      isFailed ? "border-danger/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
      selected ? "ring-2 ring-accent/50 border-accent/50" : 
      "border-white/5 shadow-xl"
    }`}>
      {/* Input Handle */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-accent !border-none" />

      {/* Node Header */}
      <div className={`px-3 py-2 flex items-center justify-between border-b transition-colors duration-500 ${
        isCircuitBreaker ? "bg-white/[0.04] border-white/10" :
        isSuccess ? "bg-white/[0.04] border-white/10" :
        isFailed ? "bg-white/[0.04] border-white/10" :
        isRunning ? "bg-accent/5 border-accent/10" :
        "bg-white/[0.03] border-white/5"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md transition-colors ${
            isCircuitBreaker ? "bg-danger text-white animate-bounce-subtle" :
            isSuccess ? "bg-white/[0.04]" :
            isFailed ? "bg-white/[0.04]" :
            isRunning ? "bg-accent/20" :
            "bg-accent/10"
          }`}>
            {isCircuitBreaker ? <AlertTriangle className="w-3 h-3" /> : isRunning ? <Loader2 className="w-3 h-3 text-accent animate-spin" /> : <Cpu className={`w-3 h-3 ${isSuccess ? "text-success" : isFailed ? "text-danger" : "text-accent"}`} />}
          </div>
          <span className="text-xs font-semibold truncate max-w-[120px] text-foreground/90">
            {data.label || "New agent"}
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-micro font-semibold transition-all ${
          isCircuitBreaker ? "bg-danger text-white border-danger" :
          isSuccess ? "bg-white/[0.04] text-success border-white/10" :
          isFailed ? "bg-white/[0.04] text-danger border-white/10" :
          isRunning ? "bg-accent/20 text-accent border-accent/30" :
          isPaused ? "bg-white/[0.04] text-warning border-white/10" :
          "bg-white/5 text-muted/80 border-white/5"
        }`}>
          {isCircuitBreaker && <AlertTriangle className="w-2 h-2" />}
          {isSuccess && <CheckCircle2 className="w-2 h-2" />}
          {isFailed && <AlertOctagon className="w-2 h-2" />}
          {isCircuitBreaker ? "SYSTEM HALTED" : (data.status || "Ready")}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-4 space-y-3 bg-canvas/50 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-50 px-2 py-1 bg-white/5 rounded-md w-fit">
            <Terminal className="w-2.5 h-2.5" />
            <span className="text-micro text-foreground">
              {data.model || "gemini-2.5-flash"}
            </span>
          </div>

          {isMultiInput && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 border border-accent/20 rounded-md">
              <Layers className="w-2.5 h-2.5 text-accent" />
              <span className="text-micro font-semibold text-accent">Multi-Input</span>
            </div>
          )}

          {/* Action Buttons (Input/Output) */}
          {(data.executionLog || isRunning) && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onInspect?.('input');
                }}
                className="p-1 hover:bg-accent/20 rounded text-muted hover:text-accent transition-colors"
                title="View input"
              >
                <Code className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onInspect?.('output');
                }}
                className="p-1 hover:bg-white/[0.04] rounded text-muted hover:text-success transition-colors"
                title="View output"
              >
                <Eye className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <p className="text-xs font-mono-data text-muted/85 italic line-clamp-3 leading-relaxed px-1 break-words">
          {data.systemPrompt || "No system protocol defined."}
        </p>

        {isFailed && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <button 
              className="w-full py-1.5 rounded-md bg-accent/20 text-accent text-micro font-semibold hover:bg-accent/30 transition-all border border-accent/30 flex items-center justify-center gap-2 group/retry"
              onClick={(e) => {
                e.stopPropagation();
                data.onRetry?.();
              }}
            >
              <Zap className="w-2.5 h-2.5 fill-current" />
              Retry step
            </button>
            <button 
              className="w-full py-1.5 rounded-md bg-white/[0.04] text-danger text-micro font-semibold hover:bg-white/[0.04] transition-all border border-white/10"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/tasks/${data.runId}`;
              }}
            >
              Debug timeline
            </button>
          </div>
        )}

        {isPaused && (
           <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-micro font-semibold text-warning/60 text-center mb-2">Waiting for you</div>
              <div className="flex gap-2">
                <button 
                  className="flex-1 py-1.5 rounded-md bg-white/[0.04] text-success text-micro font-semibold hover:bg-white/[0.04] transition-all border border-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/tasks/${data.runId}`;
                  }}
                >
                  Approve
                </button>
                <button 
                  className="flex-1 py-1.5 rounded-md bg-white/[0.04] text-danger text-micro font-semibold hover:bg-white/[0.04] transition-all border border-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/tasks/${data.runId}`;
                  }}
                >
                  Reject
                </button>
              </div>
           </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle type="source" position={Position.Bottom} className={`!w-2 !h-2 !border-none !rounded-full transition-all duration-500 ${
        isSuccess ? "!bg-success shadow-[0_0_10px_rgba(34,197,94,0.6)]" :
        isRunning ? "!bg-accent" :
        "!bg-accent/40"
      }`} />
    </div>
  );
}
