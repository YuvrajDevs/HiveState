"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function saveApiKey(provider: string, key: string) {
  if (!key || key.trim() === "") {
    return { error: "Key cannot be empty" };
  }

  try {
    // Check if key already exists for this provider
    const { data: existing } = await supabaseAdmin
      .from("api_keys")
      .select("id")
      .eq("provider", provider)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("api_keys")
        .update({ key, created_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("api_keys")
        .insert({ provider, key });
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error saving API key:", error.message);
    return { error: error.message };
  }
}
