"use client";

import { Handle, Position } from "@xyflow/react";
import { UserCheck, Pause, Info, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function HITLNode({ data, selected }: any) {
  const isPaused = data.status === "paused_hitl";
  const isSuccess = data.status === "success";
  const isFailed = data.status === "failed";
  const isRunning = data.status === "running";

  return (
    <div className={`modern-card w-[240px] transition-all duration-500 overflow-hidden rounded-xl border group ${
      isPaused ? "ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] border-yellow-500/50" :
      isSuccess ? "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
      isFailed ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
      selected ? "ring-2 ring-yellow-500/50 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : 
      "border-white/5 shadow-xl"
    }`}>
      {/* Input Handle */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-yellow-500 !border-none" />

      {/* Node Header */}
      <div className={`px-3 py-2 flex items-center justify-between border-b transition-colors duration-500 ${
        isSuccess ? "bg-green-500/5 border-green-500/10" :
        isFailed ? "bg-red-500/5 border-red-500/10" :
        isPaused ? "bg-yellow-500/10 border-yellow-500/20" :
        "bg-white/[0.03] border-white/5"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md transition-colors ${
            isSuccess ? "bg-green-500/20" :
            isFailed ? "bg-red-500/20" :
            isPaused ? "bg-yellow-500/20" :
            "bg-yellow-500/10"
          }`}>
            <UserCheck className={`w-3 h-3 ${isSuccess ? "text-green-500" : isFailed ? "text-red-500" : "text-yellow-500"}`} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px] text-foreground/90">
            {data.label || "Human Review"}
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-[7px] font-bold uppercase tracking-widest transition-all ${
          isSuccess ? "bg-green-500/20 text-green-500 border-green-500/30" :
          isFailed ? "bg-red-500/20 text-red-500 border-red-500/30" :
          isPaused ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 animate-pulse" :
          isRunning ? "bg-accent/20 text-accent border-accent/30" :
          "bg-white/5 text-muted/40 border-white/5"
        }`}>
          {isSuccess && <CheckCircle2 className="w-2 h-2" />}
          {isFailed && <XCircle className="w-2 h-2" />}
          {isPaused ? "Waiting" : data.status || "Ready"}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-4 space-y-3 bg-[#0c0c0c]/50 relative">
        <div className="flex items-center gap-2 text-yellow-500/60">
          <Pause className="w-3 h-3" />
          <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Manual Pause Point</span>
        </div>

        <p className="text-[10px] font-mono-data text-muted/60 italic line-clamp-3 leading-relaxed px-1 break-words">
          {data.instructions || "Review previous node output before continuing."}
        </p>

        {(isPaused || isSuccess || isFailed) && (
          <button 
            className="w-full py-1.5 rounded-md bg-yellow-500/10 text-yellow-500 text-[8px] font-bold uppercase tracking-widest hover:bg-yellow-500/20 transition-all border border-yellow-500/20 flex items-center justify-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              if (data.runId) {
                window.location.href = `/tasks/${data.runId}`;
              }
            }}
          >
            <Info className="w-3 h-3" />
            Inspect & Approve
          </button>
        )}
      </div>

      {/* Output Handle */}
      <Handle type="source" position={Position.Bottom} className={`!w-2 !h-2 !border-none !rounded-full transition-all duration-500 ${
        isSuccess ? "!bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" :
        isPaused ? "!bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse" :
        "!bg-yellow-500/40"
      }`} />
    </div>
  );
}
