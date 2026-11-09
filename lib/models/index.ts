import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { createModelHub, type ModelHub, type ProviderCredentials } from "./hub";
import type { ProviderId } from "./catalog";
import type { Provider } from "./types";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createMockProvider } from "./providers/mock";

const ENV_KEYS: Record<Exclude<ProviderId, "mock">, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Keys saved in Settings are cached briefly so a run does not query them for every step. */
const KEY_TTL_MS = 60_000;
let keyCache: { at: number; rows: Array<{ name: string; api_key: string; base_url: string | null; is_default: boolean }> } | null = null;

async function savedKeys() {
  if (keyCache && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.rows;
  const { data } = await supabaseAdmin.from("ai_providers").select("name, api_key, base_url, is_default").eq("is_active", true);
  keyCache = { at: Date.now(), rows: data || [] };
  return keyCache.rows;
}

export function invalidateProviderKeyCache() {
  keyCache = null;
}

/** Environment variables win over keys saved in Settings, so a deploy can pin credentials. */
export async function resolveCredentials(provider: ProviderId): Promise<ProviderCredentials | null> {
  if (provider === "mock") return { apiKey: "mock" };
  const env = process.env[ENV_KEYS[provider]];
  if (env) return { apiKey: env };
  try {
    const rows = (await savedKeys()).filter((r) => r.name === provider && r.api_key);
    const row = rows.find((r) => r.is_default) || rows[0];
    return row ? { apiKey: row.api_key, baseUrl: row.base_url } : null;
  } catch {
    return null;
  }
}

/** Which providers can be called right now (for the health check and the model picker). */
export async function configuredProviders(): Promise<Record<Exclude<ProviderId, "mock">, boolean>> {
  const [gemini, openai, anthropic] = await Promise.all([
    resolveCredentials("gemini"),
    resolveCredentials("openai"),
    resolveCredentials("anthropic"),
  ]);
  return { gemini: !!gemini, openai: !!openai, anthropic: !!anthropic };
}

function providerFactory(id: ProviderId, creds: ProviderCredentials): Provider {
  switch (id) {
    case "gemini":
      return createGeminiProvider(creds.apiKey);
    case "openai":
      return createOpenAIProvider(creds.apiKey, creds.baseUrl);
    case "anthropic":
      return createAnthropicProvider(creds.apiKey, creds.baseUrl);
    default:
      return createMockProvider();
  }
}

let hub: ModelHub | null = null;
export function getModelHub(): ModelHub {
  hub ??= createModelHub({
    credentials: resolveCredentials,
    providerFactory,
    forceMock: process.env.HIVESTATE_MOCK_LLM === "1",
  });
  return hub;
}
