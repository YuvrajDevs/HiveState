"use client";

import { stopTask } from "@/app/actions/tasks";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface StopTaskButtonProps {
  runId: string;
}

export function StopTaskButton({ runId }: StopTaskButtonProps) {
  const [isStopping, setIsStopping] = useState(false);

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm("Stop this execution sequence?")) {
      setIsStopping(true);
      try {
        await stopTask(runId);
      } catch (err) {
        console.error("Failed to stop task:", err);
        alert("Node Failure: Could not signal termination.");
      } finally {
        setIsStopping(false);
      }
    }
  };

  return (
    <button
      onClick={handleStop}
      disabled={isStopping}
      className="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[9px] font-bold uppercase text-red-500 transition-all relative z-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isStopping ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Stopping...
        </>
      ) : (
        "Stop Task"
      )}
    </button>
  );
}
