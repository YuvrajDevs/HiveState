"use client";

import { Handle, Position } from "@xyflow/react";
import { Terminal, Cpu, Eye, Code, CheckCircle2, AlertOctagon, Loader2, Zap, AlertTriangle, Layers } from "lucide-react";

export default function AgentNode({ data, selected }: any) {
  const isRunning = data.status === "running" || data.status === "resumed";
  const isSuccess = data.status === "success";
  const isFailed = data.status === "failed";
  const isPaused = data.status === "paused" || data.status === "paused_hitl" || data.status === "paused_error";
  const isCircuitBreaker = data.pause_reason === "circuit_breaker";
  const isMultiInput = data.executionLog?.input?.startsWith('{"inputs":');

  return (
    <div className={`modern-card w-[280px] transition-all duration-500 overflow-hidden rounded-xl border group ${
      isCircuitBreaker ? "ring-4 ring-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)] border-red-500 animate-pulse-slow bg-red-950/20" :
      isRunning ? "ring-2 ring-accent shadow-[0_0_30px_rgba(59,130,246,0.3)] border-accent animate-pulse" :
      isSuccess ? "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
      isFailed ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
      selected ? "ring-2 ring-accent/50 border-accent/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : 
      "border-white/5 shadow-xl"
    }`}>
      {/* Input Handle */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-accent !border-none" />

      {/* Node Header */}
      <div className={`px-3 py-2 flex items-center justify-between border-b transition-colors duration-500 ${
        isCircuitBreaker ? "bg-red-500/20 border-red-500/30" :
        isSuccess ? "bg-green-500/5 border-green-500/10" :
        isFailed ? "bg-red-500/5 border-red-500/10" :
        isRunning ? "bg-accent/5 border-accent/10" :
        "bg-white/[0.03] border-white/5"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md transition-colors ${
            isCircuitBreaker ? "bg-red-500 text-white animate-bounce-subtle" :
            isSuccess ? "bg-green-500/20" :
            isFailed ? "bg-red-500/20" :
            isRunning ? "bg-accent/20" :
            "bg-accent/10"
          }`}>
            {isCircuitBreaker ? <AlertTriangle className="w-3 h-3" /> : isRunning ? <Loader2 className="w-3 h-3 text-accent animate-spin" /> : <Cpu className={`w-3 h-3 ${isSuccess ? "text-green-500" : isFailed ? "text-red-500" : "text-accent"}`} />}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px] text-foreground/90">
            {data.label || "New Agent"}
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-[7px] font-bold uppercase tracking-widest transition-all ${
          isCircuitBreaker ? "bg-red-500 text-white border-red-400 animate-pulse" :
          isSuccess ? "bg-green-500/20 text-green-500 border-green-500/30" :
          isFailed ? "bg-red-500/20 text-red-500 border-red-500/30" :
          isRunning ? "bg-accent/20 text-accent border-accent/30" :
          isPaused ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" :
          "bg-white/5 text-muted/40 border-white/5"
        }`}>
          {isCircuitBreaker && <AlertTriangle className="w-2 h-2" />}
          {isSuccess && <CheckCircle2 className="w-2 h-2" />}
          {isFailed && <AlertOctagon className="w-2 h-2" />}
          {isCircuitBreaker ? "SYSTEM HALTED" : (data.status || "Ready")}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-4 space-y-3 bg-[#0c0c0c]/50 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-50 px-2 py-1 bg-white/5 rounded-md w-fit">
            <Terminal className="w-2.5 h-2.5" />
            <span className="text-[9px] font-mono-data uppercase tracking-widest text-foreground">
              {data.model || "gemini-2.5-flash"}
            </span>
          </div>

          {isMultiInput && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 border border-accent/20 rounded-md animate-pulse">
              <Layers className="w-2.5 h-2.5 text-accent" />
              <span className="text-[8px] font-bold text-accent uppercase tracking-tighter">Multi-Input</span>
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
                title="View Input"
              >
                <Code className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  data.onInspect?.('output');
                }}
                className="p-1 hover:bg-green-500/20 rounded text-muted hover:text-green-500 transition-colors"
                title="View Output"
              >
                <Eye className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] font-mono-data text-muted/60 italic line-clamp-3 leading-relaxed px-1 break-words">
          {data.systemPrompt || "No system protocol defined."}
        </p>

        {isFailed && (
          <div className="pt-2 border-t border-red-500/10 space-y-2">
            <button 
              className="w-full py-1.5 rounded-md bg-accent/20 text-accent text-[8px] font-bold uppercase tracking-[0.2em] hover:bg-accent/30 transition-all border border-accent/30 flex items-center justify-center gap-2 group/retry"
              onClick={(e) => {
                e.stopPropagation();
                data.onRetry?.();
              }}
            >
              <Zap className="w-2.5 h-2.5 fill-current" />
              Retry Step
            </button>
            <button 
              className="w-full py-1.5 rounded-md bg-red-500/10 text-red-500 text-[8px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/tasks/${data.runId}`;
              }}
            >
              Debug Timeline
            </button>
          </div>
        )}

        {isPaused && (
           <div className="pt-2 border-t border-yellow-500/10 space-y-2">
              <div className="text-[7px] font-bold text-yellow-500/60 uppercase tracking-widest text-center mb-2">Manual Intervention Required</div>
              <div className="flex gap-2">
                <button 
                  className="flex-1 py-1.5 rounded-md bg-green-500/10 text-green-500 text-[8px] font-bold uppercase tracking-widest hover:bg-green-500/20 transition-all border border-green-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/tasks/${data.runId}`;
                  }}
                >
                  Approve
                </button>
                <button 
                  className="flex-1 py-1.5 rounded-md bg-red-500/10 text-red-500 text-[8px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
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
        isSuccess ? "!bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" :
        isRunning ? "!bg-accent shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-ping" :
        "!bg-accent/40"
      }`} />
    </div>
  );
}
