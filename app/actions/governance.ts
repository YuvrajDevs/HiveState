"use server";

import { supabaseAdmin } from "@/lib/supabase";

export async function getGovernanceSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from("governance_settings")
      .select("*")
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    return { success: true, settings: data };
  } catch (error: any) {
    console.error("Failed to fetch governance settings:", error);
    return { success: false, error: error.message };
  }
}

export async function updateGovernanceSettings(settings: any) {
  try {
    const { data, error } = await supabaseAdmin
      .from("governance_settings")
      .upsert({ ...settings, updated_at: new Date().toISOString() })
      .select()
      .single();
    
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
