"use server";
import type { Canvas } from "@/types/domain";

import { errorMessage } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
  } catch (error: unknown) {
    console.error("Error fetching workflow:", errorMessage(error));
    return { error: errorMessage(error) };
  }
}

export async function updateWorkflowCanvas(id: string, canvasJson: Canvas) {
  if (!id || id === "null" || id === "undefined") {
    return { error: "Invalid workflow ID" };
  }
  const cleanId = id.trim();
  console.log(`[ACTION] Updating canvas for ID: "${cleanId}" (Type: ${typeof cleanId})`);
  
  try {
    const { data, error, count } = await supabaseAdmin
      .from("workflows")
      .update({ canvas_json: canvasJson })
      .eq("id", cleanId)
      .select();

    if (error) {
      console.error("[DB ERROR] Update failed:", error);
      return { error: errorMessage(error) };
    }
    
    console.log(`[ACTION] Update result: ${data?.length} rows affected. Count: ${count}`);
    
    if (!data || data.length === 0) {
      console.warn("[ACTION] No rows were updated. Check if ID exists.");
    }

    revalidatePath(`/workflows/${cleanId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("[ACTION ERROR] updateWorkflowCanvas:", errorMessage(error));
    return { error: errorMessage(error) };
  }
}

export async function createWorkflow(name: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .insert({ name, canvas_json: { nodes: [], edges: [] } })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath("/workflows");
    return { data };
  } catch (error: unknown) {
    console.error("Error creating workflow:", errorMessage(error));
    return { error: errorMessage(error) };
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
  } catch (error: unknown) {
    console.error("Error renaming workflow:", errorMessage(error));
    return { error: errorMessage(error) };
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
  } catch (error: unknown) {
    console.error("Error fetching templates:", errorMessage(error));
    return { error: errorMessage(error) };
  }
}

export async function createFromTemplate(templateId: string, customName?: string) {
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
    
    revalidatePath("/workflows");
    return { data };
  } catch (error: unknown) {
    console.error("Error using template:", errorMessage(error));
    return { error: errorMessage(error) };
  }
}
