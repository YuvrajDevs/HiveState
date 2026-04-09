"use server";

import { resumeWorkflow } from "@/lib/engine/runner";
import { revalidatePath } from "next/cache";

export async function resumeWorkflowAction(runId: string, nodeId?: string, editedInput?: string) {
  if (!runId) return { error: "Missing run ID" };

  try {
    console.log(`[ACTION] Resuming workflow run: ${runId} ${nodeId ? `at node ${nodeId}` : ''}`);
    
    // The runner will update the status to 'resumed' and continue
    // Note: runWorkflow is async but we don't necessarily want to wait for the whole thing 
    // to finish here if it takes minutes. However, for small tasks it's fine.
    // The UI polls for status updates anyway.
    
    const result = await resumeWorkflow(runId, nodeId, editedInput);
    
    revalidatePath(`/tasks/${runId}`);
    return { success: true, result };
  } catch (error: any) {
    console.error("[ACTION ERROR] resumeWorkflowAction:", error.message);
    return { error: error.message };
  }
}
