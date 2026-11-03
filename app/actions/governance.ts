"use server";

import { supabaseAdmin } from "@/lib/supabase";

export async function getGovernanceSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from("governance_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    
    return { success: true, settings: data };
  } catch (error: any) {
    console.error("Failed to fetch governance settings:", error);
    return { success: false, error: error.message };
  }
}

export async function updateGovernanceSettings(settings: any) {
  try {
    // Keep exactly one settings row: update it by id instead of inserting a new row on every save
    const { data: existing } = await supabaseAdmin
      .from("governance_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = { ...(settings ?? {}), updated_at: new Date().toISOString() };
    delete payload.id;
    const { data, error } = existing
      ? await supabaseAdmin.from("governance_settings").update(payload).eq("id", existing.id).select().single()
      : await supabaseAdmin.from("governance_settings").insert(payload).select().single();
    
    if (error) throw error;
    
    return { success: true, settings: data };
  } catch (error: any) {
    console.error("Failed to update governance settings:", error);
    return { success: false, error: error.message };
  }
}

export async function getTodaySpend() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_today_spend');
    if (error) throw error;
    return { success: true, spend: data };
  } catch (error: any) {
    console.error("Failed to fetch today spend:", error);
    return { success: false, error: error.message };
  }
}
