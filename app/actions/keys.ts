"use server";

import { SETTINGS_LOCKED_MESSAGE, settingsLocked } from "@/lib/demo";

import { errorMessage } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function saveApiKey(provider: string, key: string) {
  if (settingsLocked()) return { error: SETTINGS_LOCKED_MESSAGE };
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
  } catch (error: unknown) {
    console.error("Error saving API key:", errorMessage(error));
    return { error: errorMessage(error) };
  }
}
