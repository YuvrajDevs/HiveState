import { generateGeminiOutcome } from "./gemini";
import { supabaseAdmin } from "./supabase";

export interface ExecutionOutcome {
  text: string;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelUsed: string;
  isFallback: boolean;
}

/**
 * Unified Model Hub for HiveState.
 * Handles provider resolution, primary/fallback routing, and budget enforcement precursors.
 */
export async function executeUnifiedModel(
  systemPrompt: string,
  userPrompt: string,
  config: {
    primaryModel?: string;
    fallbackModel?: string;
    overrideProvider?: string;
  }
): Promise<ExecutionOutcome> {
  // Fetch governance settings if not provided
  let primaryModel = config.primaryModel;
  let fallbackModel = config.fallbackModel;

  if (!primaryModel || !fallbackModel) {
    const { data: settings } = await supabaseAdmin
      .from("governance_settings")
      .select("*")
      .single();
    
    if (settings) {
      primaryModel = primaryModel || settings.primary_model;
      fallbackModel = fallbackModel || settings.fallback_model;
    }
  }

  // Fallback defaults if still missing
    primaryModel = primaryModel || "gemini-2.5-flash";
    fallbackModel = fallbackModel || "gemini-2.5-flash";

  try {
    // Attempt Primary Model
    console.log(`🎯 Models Hub: Attempting Primary [${primaryModel}]`);
    const outcome = await generateGeminiOutcome(systemPrompt, userPrompt, primaryModel);
    
    return {
      text: outcome.text,
      usageMetadata: {
        promptTokenCount: outcome.usageMetadata?.promptTokenCount || 0,
        candidatesTokenCount: outcome.usageMetadata?.candidatesTokenCount || 0,
        totalTokenCount: outcome.usageMetadata?.totalTokenCount || 0,
      },
      modelUsed: primaryModel,
      isFallback: false
    };

  } catch (err: any) {
    // Check if error is a candidate for fallback (429, 5xx, or timeout)
    const errorMsg = err.message || "";
    const isRetryable = errorMsg.includes("429") || errorMsg.includes("500") || errorMsg.includes("503") || errorMsg.includes("quota") || errorMsg.includes("limit");

    if (isRetryable && fallbackModel && fallbackModel !== primaryModel) {
      console.warn(`🔄 Models Hub: Primary failed. Triggering Fallback [${fallbackModel}]...`);
      try {
        const fallbackOutcome = await generateGeminiOutcome(systemPrompt, userPrompt, fallbackModel);
        return {
          text: fallbackOutcome.text,
          usageMetadata: {
            promptTokenCount: fallbackOutcome.usageMetadata?.promptTokenCount || 0,
            candidatesTokenCount: fallbackOutcome.usageMetadata?.candidatesTokenCount || 0,
            totalTokenCount: fallbackOutcome.usageMetadata?.totalTokenCount || 0,
          },
          modelUsed: fallbackModel,
          isFallback: true
        };
      } catch (fallbackErr: any) {
        console.error(`❌ Models Hub: Fallback also failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    // If not retryable or no fallback defined, rethrow
    throw err;
  }
}
