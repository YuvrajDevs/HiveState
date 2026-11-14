import type { LogStatus } from "@/types/domain";

/**
 * One place that turns a run or step status into words and a tone, so every screen says the same thing.
 * Tones colour only the text and icon; backgrounds stay neutral so state never shouts.
 */
export type StatusTone = "success" | "warning" | "danger" | "accent";

export const STATUS_TONE: Record<StatusTone, { box: string; chip: string; text: string }> = {
  success: { box: "bg-white/[0.04] border-white/10 text-success", chip: "bg-white/[0.05] text-success", text: "text-success" },
  warning: { box: "bg-white/[0.04] border-white/10 text-warning", chip: "bg-white/[0.05] text-warning", text: "text-warning" },
  danger: { box: "bg-white/[0.04] border-white/10 text-danger", chip: "bg-white/[0.05] text-danger", text: "text-danger" },
  accent: { box: "bg-white/[0.04] border-white/10 text-accent", chip: "bg-white/[0.05] text-accent", text: "text-accent" },
};

export function runLabel(status: string | undefined, anyFailed = false): { text: string; tone: StatusTone } {
  switch (status) {
    case "completed": return { text: "Completed", tone: "success" };
    case "running":
    case "resumed": return { text: "Running", tone: "accent" };
    case "paused_hitl": return { text: "Needs review", tone: "warning" };
    case "paused_error": return { text: "Paused on error", tone: "warning" };
    case "failed": return { text: "Failed", tone: "danger" };
    case "aborted":
    case "stopped": return { text: "Stopped", tone: "danger" };
    default: return anyFailed ? { text: "Failed", tone: "danger" } : { text: "Completed", tone: "success" };
  }
}

export function logLabel(status: LogStatus | string): { text: string; tone: StatusTone } {
  switch (status) {
    case "success": return { text: "Done", tone: "success" };
    case "paused_hitl": return { text: "Waiting for review", tone: "warning" };
    case "paused_error": return { text: "Paused on error", tone: "warning" };
    default: return { text: "Failed", tone: "danger" };
  }
}
