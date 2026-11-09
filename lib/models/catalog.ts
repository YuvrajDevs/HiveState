/**
 * Model catalogue: which provider serves a model and what it costs.
 * Prices are list prices in USD per 1M tokens (checked November 2026) and are converted to INR,
 * the currency of the budget guard. Override the rate with USD_INR_RATE.
 * Client-safe: no SDK imports here, so the canvas and the cost estimate can use it.
 */

export type ProviderId = "gemini" | "openai" | "anthropic" | "mock";

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  label: string;
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  tier: "fast" | "balanced" | "frontier";
}

export const MODELS: ModelInfo[] = [
  { id: "gemini-2.5-flash-lite", provider: "gemini", label: "Gemini 2.5 Flash-Lite", input: 0.1, output: 0.4, tier: "fast" },
  { id: "gemini-2.5-flash", provider: "gemini", label: "Gemini 2.5 Flash", input: 0.3, output: 2.5, tier: "balanced" },
  { id: "gemini-2.5-pro", provider: "gemini", label: "Gemini 2.5 Pro", input: 1.25, output: 10, tier: "frontier" },
  { id: "gpt-5-mini", provider: "openai", label: "GPT-5 mini", input: 0.25, output: 2, tier: "fast" },
  { id: "gpt-4.1-mini", provider: "openai", label: "GPT-4.1 mini", input: 0.4, output: 1.6, tier: "balanced" },
  { id: "gpt-5", provider: "openai", label: "GPT-5", input: 1.25, output: 10, tier: "frontier" },
  { id: "claude-haiku-5-5", provider: "anthropic", label: "Claude Haiku 5.5", input: 0.1, output: 0.5, tier: "fast" },
  { id: "claude-sonnet-5-5", provider: "anthropic", label: "Claude Sonnet 5.5", input: 2, output: 10, tier: "balanced" },
  { id: "claude-opus-5-5", provider: "anthropic", label: "Claude Opus 5.5", input: 4, output: 20, tier: "frontier" },
];

/** Retired or renamed IDs that older canvases and templates still reference. */
export const MODEL_ALIASES: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash-lite",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
  "gpt-4o": "gpt-4.1-mini",
  "gpt-4o-mini": "gpt-5-mini",
};

export const DEFAULT_MODEL = "gemini-2.5-flash";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
  mock: "Offline mock",
};

export function usdToInr(): number {
  const fromEnv = typeof process !== "undefined" ? Number(process.env?.USD_INR_RATE) : NaN;
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 88;
}

export function resolveModelId(id: string | null | undefined): string {
  if (!id) return DEFAULT_MODEL;
  return MODEL_ALIASES[id] || id;
}

export function getModel(id: string | null | undefined): ModelInfo | undefined {
  return MODELS.find((m) => m.id === resolveModelId(id));
}

/** Provider for a model ID, inferring from the prefix for IDs not in the table. */
export function providerFor(id: string | null | undefined): ProviderId {
  const resolved = resolveModelId(id);
  const known = MODELS.find((m) => m.id === resolved);
  if (known) return known.provider;
  if (resolved.startsWith("mock")) return "mock";
  if (resolved.startsWith("claude")) return "anthropic";
  if (/^(gpt|o\d|chatgpt)/.test(resolved)) return "openai";
  return "gemini";
}

/** Cost in INR. Unknown models are priced like the default model, so spend is never under-counted as zero. */
export function costInr(modelId: string | null | undefined, inputTokens: number, outputTokens: number): number {
  if (providerFor(modelId) === "mock") return 0;
  const m = getModel(modelId) || getModel(DEFAULT_MODEL)!;
  const usd = (inputTokens * m.input + outputTokens * m.output) / 1_000_000;
  return usd * usdToInr();
}

/** Rough token count for estimates: ~4 characters per token for English text. */
export function approxTokens(text: string | null | undefined): number {
  return text ? Math.ceil(text.length / 4) : 0;
}
