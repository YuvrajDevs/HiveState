"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { resumeWorkflow } from "@/lib/engine/runner";

/**
 * Clears all tasks with status 'completed' or 'failed'.
 * Tasks with status 'running' are preserved to avoid interrupting active executions.
 */
export async function clearCompletedTasks() {
  try {
    const { error } = await supabaseAdmin
      .from("runs")
      .delete()
      .in("status", ["completed", "failed"]);

    if (error) {
      console.error("Error clearing tasks:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error clearing tasks:", err);
    return { success: false, error: err.message || "Internal server error" };
  }
}

/**
 * Stops a running task by setting status to 'failed'.
 * In a real production system, this would also signal the execution engine to abort.
 */
export async function stopTask(runId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("runs")
      .update({ 
        status: "failed",
        completed_at: new Date().toISOString()
      })
      .eq("id", runId);

    if (error) {
      console.error("Error stopping task:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/tasks");
    revalidatePath("/tasks/" + runId);
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error stopping task:", err);
    return { success: false, error: err.message || "Internal server error" };
  }
}

/**
 * Stops ALL running tasks.
 */
export async function stopAllTasks() {
  try {
    const { error } = await supabaseAdmin
      .from("runs")
      .update({ 
        status: "failed",
        completed_at: new Date().toISOString()
      })
      .eq("status", "running");

    if (error) {
      console.error("Error stopping all tasks:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error stopping all tasks:", err);
    return { success: false, error: err.message || "Internal server error" };
  }
}

/**
 * Resumes a paused task.
 */
export async function resumeTask(runId: string, nodeId?: string, editedInput?: string) {
  try {
    // If input was edited, we should technically update the log for that node 
    // to reflect what's about to be sent
    if (nodeId && editedInput) {
       await supabaseAdmin
         .from("logs")
         .update({ input: editedInput })
         .eq("run_id", runId)
         .eq("node_id", nodeId);
    }

    // Trigger the engine's resume logic
    // Note: This starts a background execution
    resumeWorkflow(runId, nodeId, editedInput);

    revalidatePath("/tasks");
    revalidatePath("/tasks/" + runId);
    return { success: true };
  } catch (err: any) {
    console.error("Error resuming task:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Human-In-The-Loop Approval.
 */
export async function approveTask(runId: string, nodeId: string, correctionNote?: string) {
  try {
    // If a correction was provided during approval, log it
    if (correctionNote) {
      await supabaseAdmin
        .from("logs")
        .update({ correction_note: correctionNote, status: "success" })
        .eq("run_id", runId)
        .eq("node_id", nodeId);
    } else {
      // Just mark the HITL node as success to let the engine continue
      await supabaseAdmin
        .from("logs")
        .update({ status: "success" })
        .eq("run_id", runId)
        .eq("node_id", nodeId);
    }
    
    // Trigger the engine's resume logic
    // Reset failures on approval
    await supabaseAdmin
      .from("runs")
      .update({ 
        consecutive_failures_count: 0, 
        circuit_breaker_triggered: false 
      })
      .eq("id", runId);
      
    return resumeTask(runId);

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


/**
 * Human-In-The-Loop Rejection with Correction.
 */
export async function rejectTask(runId: string, nodeId: string, correctionNote: string) {
  try {
    // Log the rejection
    await supabaseAdmin
      .from("logs")
      .update({ correction_note: correctionNote, status: "failed" })
      .eq("run_id", runId)
      .eq("node_id", nodeId);

    // After rejection, user can manually resume later or we can restart from this node 
    // with the correction injected into context.
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
