"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeData } from "@/types/domain";
import { UserCheck, Pause, Info, CheckCircle2, XCircle } from "lucide-react";

export default function HITLNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const isPaused = data.status === "paused_hitl";
  const isSuccess = data.status === "success";
  const isFailed = data.status === "failed";
  const isRunning = data.status === "running";

  return (
    <div className={`modern-card w-[240px] transition-all duration-500 overflow-hidden rounded-xl border group ${
      isPaused ? "ring-2 ring-warning shadow-[0_0_30px_rgba(234,179,8,0.3)] border-warning/50" :
      isSuccess ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
      isFailed ? "border-danger/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
      selected ? "ring-2 ring-warning/50 border-warning/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : 
      "border-white/5 shadow-xl"
    }`}>
      {/* Input Handle */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-warning !border-none" />

      {/* Node Header */}
      <div className={`px-3 py-2 flex items-center justify-between border-b transition-colors duration-500 ${
        isSuccess ? "bg-white/[0.04] border-white/10" :
        isFailed ? "bg-white/[0.04] border-white/10" :
        isPaused ? "bg-white/[0.04] border-white/10" :
        "bg-white/[0.03] border-white/5"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md transition-colors ${
            isSuccess ? "bg-white/[0.04]" :
            isFailed ? "bg-white/[0.04]" :
            isPaused ? "bg-white/[0.04]" :
            "bg-white/[0.04]"
          }`}>
            <UserCheck className={`w-3 h-3 ${isSuccess ? "text-success" : isFailed ? "text-danger" : "text-warning"}`} />
          </div>
          <span className="text-xs font-semibold truncate max-w-[120px] text-foreground/90">
            {data.label || "Human review"}
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-micro font-semibold transition-all ${
          isSuccess ? "bg-white/[0.04] text-success border-white/10" :
          isFailed ? "bg-white/[0.04] text-danger border-white/10" :
          isPaused ? "bg-white/[0.04] text-warning border-white/10" :
          isRunning ? "bg-accent/20 text-accent border-accent/30" :
          "bg-white/5 text-muted/80 border-white/5"
        }`}>
          {isSuccess && <CheckCircle2 className="w-2 h-2" />}
          {isFailed && <XCircle className="w-2 h-2" />}
          {isPaused ? "Waiting" : data.status || "Ready"}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-4 space-y-3 bg-canvas/50 relative">
        <div className="flex items-center gap-2 text-warning/60">
          <Pause className="w-3 h-3" />
          <span className="text-micro font-semibold">Manual pause point</span>
        </div>

        <p className="text-xs font-mono-data text-muted/85 italic line-clamp-3 leading-relaxed px-1 break-words">
          {data.instructions || "Review previous node output before continuing."}
        </p>

        {(isPaused || isSuccess || isFailed) && (
          <button 
            className="w-full py-1.5 rounded-md bg-white/[0.04] text-warning text-micro font-semibold hover:bg-white/[0.04] transition-all border border-white/10 flex items-center justify-center gap-2"
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
        isSuccess ? "!bg-success shadow-[0_0_10px_rgba(34,197,94,0.6)]" :
        isPaused ? "!bg-warning shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse" :
        "!bg-warning/40"
      }`} />
    </div>
  );
}
