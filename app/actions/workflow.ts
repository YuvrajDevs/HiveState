"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/store/supabase";
import { UUID_RE } from "@/lib/http/errors";

export async function getWorkflow(id: string) {
  if (!id || id === "null" || id === "undefined") {
    return { error: "Invalid workflow ID" };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return { data };
  } catch (error: any) {
    console.error("Error fetching workflow:", error.message);
    return { error: error.message };
  }
}

/** Saves the canvas. A changed canvas becomes a new immutable version; returns its number. */
export async function updateWorkflowCanvas(id: string, canvasJson: any, note?: string) {
  if (!id || !UUID_RE.test(id.trim())) {
    return { error: "Invalid workflow ID" };
  }
  const cleanId = id.trim();
  if (!canvasJson || !Array.isArray(canvasJson.nodes) || !Array.isArray(canvasJson.edges)) {
    return { error: "Invalid canvas" };
  }
  try {
    const version = await getStore().saveWorkflowCanvas(cleanId, canvasJson, note);
    revalidatePath(`/workflows/${cleanId}`);
    revalidatePath("/workflows");
    return { success: true, version };
  } catch (error: any) {
    // Database without the versioning migration: fall back to a plain update.
    if (/save_workflow_version/.test(error.message)) {
      const { error: e2 } = await supabaseAdmin.from("workflows").update({ canvas_json: canvasJson }).eq("id", cleanId);
      if (!e2) return { success: true, version: null };
    }
    console.error("[ACTION ERROR] updateWorkflowCanvas:", error.message);
    return { error: error.message };
  }
}

/** Copies a workflow (canvas only, no history) under a new name. */
export async function duplicateWorkflow(id: string) {
  try {
    const { data: source, error } = await supabaseAdmin.from("workflows").select("name, canvas_json").eq("id", id).single();
    if (error) throw error;
    const { data, error: insErr } = await supabaseAdmin
      .from("workflows")
      .insert({ name: `${source.name} (copy)`, canvas_json: source.canvas_json || { nodes: [], edges: [] }, is_template: false })
      .select()
      .single();
    if (insErr) throw insErr;
    if (source.canvas_json) await getStore().saveWorkflowCanvas(data.id, source.canvas_json, `Duplicated from ${source.name}`).catch(() => undefined);
    revalidatePath("/workflows");
    return { data };
  } catch (error: any) {
    console.error("Error duplicating workflow:", error.message);
    return { error: error.message };
  }
}

/** Makes an earlier version current again. Recorded as a new version, so nothing is lost. */
export async function restoreWorkflowVersion(id: string, version: number) {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflow_versions")
      .select("canvas_json")
      .eq("workflow_id", id)
      .eq("version", version)
      .single();
    if (error) throw error;
    const newVersion = await getStore().saveWorkflowCanvas(id, data.canvas_json, `Restored from v${version}`);
    revalidatePath(`/workflows/${id}`);
    return { success: true, version: newVersion, canvas: data.canvas_json };
  } catch (error: any) {
    console.error("Error restoring version:", error.message);
    return { error: error.message };
  }
}

/** Deletes a workflow. Its runs are kept (workflow_id becomes null) so history and spend stay accurate. */
export async function deleteWorkflow(id: string) {
  try {
    const { error } = await supabaseAdmin.from("workflows").delete().eq("id", id).eq("is_template", false);
    if (error) throw error;
    revalidatePath("/workflows");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting workflow:", error.message);
    return { error: error.message };
  }
}

export async function createWorkflow(name: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .insert({ name: name?.trim() || "Untitled workflow", canvas_json: { nodes: [], edges: [] } })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath("/workflows");
    return { data };
  } catch (error: any) {
    console.error("Error creating workflow:", error.message);
    return { error: error.message };
  }
}

export async function renameWorkflow(id: string, newName: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .update({ name: newName })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/workflows");
    revalidatePath(`/workflows/${id}`);
    return { data };
  } catch (error: any) {
    console.error("Error renaming workflow:", error.message);
    return { error: error.message };
  }
}

export async function getTemplates() {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("is_template", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error: any) {
    console.error("Error fetching templates:", error.message);
    return { error: error.message };
  }
}

export async function useTemplate(templateId: string, customName?: string) {
  try {
    // 1. Fetch template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", templateId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Create new workflow from template
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .insert({ 
        name: customName || `${template.template_name || template.name} (Clone)`, 
        canvas_json: template.canvas_json,
        is_template: false 
      })
      .select()
      .single();

    if (error) throw error;
    if (template.canvas_json) {
      await getStore().saveWorkflowCanvas(data.id, template.canvas_json, `Created from template ${template.template_name || template.name}`).catch(() => undefined);
    }

    revalidatePath("/workflows");
    return { data };
  } catch (error: any) {
    console.error("Error using template:", error.message);
    return { error: error.message };
  }
}
