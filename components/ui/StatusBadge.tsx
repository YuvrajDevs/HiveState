import { CheckCircle2, AlertOctagon, Loader2, Clock, PauseCircle, StopCircle, AlertTriangle } from "lucide-react";

export const RUN_STATUS: Record<string, { label: string; tone: string; Icon: typeof Clock; spin?: boolean }> = {
  queued: { label: "Queued", tone: "text-neutral-300 border-white/15 bg-white/5", Icon: Clock },
  running: { label: "Running", tone: "text-accent border-accent/30 bg-accent/10", Icon: Loader2, spin: true },
  resumed: { label: "Running", tone: "text-accent border-accent/30 bg-accent/10", Icon: Loader2, spin: true },
  completed: { label: "Completed", tone: "text-green-400 border-green-500/30 bg-green-500/10", Icon: CheckCircle2 },
  paused_hitl: { label: "Needs review", tone: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10", Icon: PauseCircle },
  paused_error: { label: "Paused on error", tone: "text-red-300 border-red-500/30 bg-red-500/10", Icon: AlertTriangle },
  failed: { label: "Failed", tone: "text-red-300 border-red-500/30 bg-red-500/10", Icon: AlertOctagon },
  stopped: { label: "Stopped", tone: "text-neutral-400 border-white/15 bg-white/5", Icon: StopCircle },
  aborted: { label: "Stopped", tone: "text-neutral-400 border-white/15 bg-white/5", Icon: StopCircle },
};

/** Run status with icon and text (never colour alone). */
export function StatusBadge({ status, pauseReason }: { status: string; pauseReason?: string | null }) {
  const s = RUN_STATUS[status] || RUN_STATUS.queued;
  const label = status === "paused_error" && pauseReason === "circuit_breaker" ? "Halted (repeated failures)" : status === "paused_error" && pauseReason === "budget_limit" ? "Paused (budget)" : s.label;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>
      <s.Icon className={`h-3 w-3 ${s.spin ? "animate-spin" : ""}`} aria-hidden /> {label}
    </span>
  );
}
