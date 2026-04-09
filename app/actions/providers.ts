"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export type AIProvider = {
  id: string;
  name: string;
  label: string | null;
  api_key: string;
  base_url: string | null;
  rate_limit: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
};

// Mask API Key (e.g. sk-****1234)
function maskKey(key: string) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function getProviders() {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_providers")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      if (error.message.includes("API key")) {
        throw new Error("Supabase Connection Error: Your SUPABASE_SERVICE_ROLE_KEY is invalid or mismatched. Check Vercel Environment Variables.");
      }
      throw error;
    }

    // Mask keys before sending to client
    return {
      success: true,
      providers: (data || []).map((p: AIProvider) => ({
        ...p,
        api_key: maskKey(p.api_key),
      })),
    };
  } catch (error: any) {
    console.error("⛔ [ACTION] getProviders failed:", error.message);
    return { 
      success: false, 
      error: error.message,
      isSupabaseError: error.message.includes("Supabase Connection Error")
    };
  }
}

export async function saveProvider(provider: Partial<AIProvider>) {
  try {
    const updateData: any = {
      ...provider,
      updated_at: new Date().toISOString(),
    };

    // If key is empty string (standard for "no change" in this UI), remove it from update
    if (!updateData.api_key) {
      delete updateData.api_key;
    }

    const { data, error } = await supabaseAdmin
      .from("ai_providers")
      .upsert({
        ...updateData,
        id: provider.id || undefined, // Create new if no ID
      })
      .select()
      .single();

    if (error) throw error;

    // If this is set as default, unset others (simplified approach)
    if (provider.is_default) {
      await supabaseAdmin
        .from("ai_providers")
        .update({ is_default: false })
        .neq("id", data.id);
    }

    revalidatePath("/settings");
    return { success: true, provider: data };
  } catch (error: any) {
    console.error("Error saving provider:", error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteProvider(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting provider:", error.message);
    return { success: false, error: error.message };
  }
}

export async function setDefaultProvider(id: string) {
  try {
    // 1. Unset all defaults
    await supabaseAdmin
      .from("ai_providers")
      .update({ is_default: false });

    // 2. Set new default
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .update({ is_default: true })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error setting default provider:", error.message);
    return { success: false, error: error.message };
  }
}

export async function toggleProviderStatus(id: string, isActive: boolean) {
  try {
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling provider status:", error.message);
    return { success: false, error: error.message };
  }
}
