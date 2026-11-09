"use server";

import { resumeTask } from "./tasks";

/** Retries a paused run from the canvas view. */
export async function resumeWorkflowAction(runId: string) {
  if (!runId) return { error: "Missing run ID" };
  const res = await resumeTask(runId);
  return res.success ? { success: true } : { error: res.error };
}
