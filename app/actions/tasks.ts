"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { dispatchRun } from "@/lib/queue/dispatch";
import { getStore } from "@/lib/store/supabase";
import { prepareRerun } from "@/lib/engine/rerun";
import { assertBudgetAvailable } from "@/lib/engine/runner";

type Result = { success: true; runId?: string } | { success: false; error: string };

function fail(err: unknown): Result {
  const message = (err as Error)?.message || "Something went wrong";
  console.error("[action]", message);
  return { success: false, error: message };
}

function refresh(runId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/");
  if (runId) revalidatePath(`/tasks/${runId}`);
}

/**
 * Deletes finished runs (completed, failed, stopped). Active and paused runs are kept.
 * On the public demo (DEMO_MODE=1) the seeded demo runs are protected.
 */
export async function clearCompletedTasks(): Promise<Result> {
  try {
    let q = supabaseAdmin.from("runs").delete().in("status", ["completed", "failed", "stopped"]);
    if (process.env.DEMO_MODE === "1") q = q.eq("is_demo", false);
    const { error } = await q;
    if (error) throw new Error(error.message);
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/** Stops a run. The engine checks between levels and stops; steps already done are kept. */
export async function stopTask(runId: string): Promise<Result> {
  try {
    const { error } = await supabaseAdmin
      .from("runs")
      .update({ status: "stopped", error: "Stopped by user", completed_at: new Date().toISOString() })
      .eq("id", runId)
      .in("status", ["queued", "running", "resumed", "paused_hitl", "paused_error"]);
    if (error) throw new Error(error.message);
    refresh(runId);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function stopAllTasks(): Promise<Result> {
  try {
    const { error } = await supabaseAdmin
      .from("runs")
      .update({ status: "stopped", error: "Stopped by user", completed_at: new Date().toISOString() })
      .in("status", ["queued", "running", "resumed"]);
    if (error) throw new Error(error.message);
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Retries a paused run. With `editedInput`, that step runs with the edited input instead of
 * the one computed from its parents (recorded on the run, so the trace shows what was sent).
 */
export async function resumeTask(runId: string, nodeId?: string, editedInput?: string): Promise<Result> {
  try {
    const store = getStore();
    const run = await store.getRun(runId);
    if (!run) throw new Error("Run not found.");
    if (nodeId && editedInput !== undefined && editedInput.trim() !== "") {
      await store.updateRun(runId, { input_overrides: { ...(run.input_overrides || {}), [nodeId]: editedInput } });
    }
    await store.updateRun(runId, { status: "queued", consecutive_failures_count: run.pause_reason === "circuit_breaker" ? 0 : run.consecutive_failures_count, circuit_breaker_triggered: false });
    await dispatchRun(runId, "resume");
    refresh(runId);
    return { success: true, runId };
  } catch (err) {
    return fail(err);
  }
}

/** Approves the review step the run is waiting on and continues the run. */
export async function approveTask(runId: string, nodeId: string, correctionNote?: string): Promise<Result> {
  try {
    const { error } = await supabaseAdmin
      .from("logs")
      .update({ status: "success", correction_note: correctionNote?.trim() || null })
      .eq("run_id", runId)
      .eq("node_id", nodeId)
      .eq("status", "paused_hitl");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("runs").update({ consecutive_failures_count: 0, circuit_breaker_triggered: false }).eq("id", runId);
    return resumeTask(runId);
  } catch (err) {
    return fail(err);
  }
}

/** Rejects the review step. The run stays paused; resuming asks for review again. */
export async function rejectTask(runId: string, nodeId: string, correctionNote: string): Promise<Result> {
  try {
    const { error } = await supabaseAdmin
      .from("logs")
      .update({ correction_note: correctionNote, status: "failed", error: "Rejected by reviewer" })
      .eq("run_id", runId)
      .eq("node_id", nodeId)
      .eq("status", "paused_hitl");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("runs").update({ status: "stopped", error: `Rejected at review: ${correctionNote || "no reason given"}` }).eq("id", runId);
    refresh(runId);
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/** Starts a new run from an earlier one, optionally from one step onwards. */
export async function rerunTask(runId: string, fromNodeId?: string): Promise<Result> {
  try {
    await assertBudgetAvailable();
    const run = await prepareRerun(getStore(), runId, fromNodeId);
    await dispatchRun(run.id, "run");
    refresh(run.id);
    return { success: true, runId: run.id };
  } catch (err) {
    return fail(err);
  }
}
