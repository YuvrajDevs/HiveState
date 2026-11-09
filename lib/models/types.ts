import type { ProviderId } from "./catalog";

export interface GenerateRequest {
  model: string;
  system: string;
  prompt: string;
  signal?: AbortSignal;
  /** Called with each text chunk as it streams in. */
  onDelta?: (chunk: string) => void;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Provider {
  id: ProviderId;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

/** Raised when a provider has no API key. Not transient, but it does trigger the fallback model. */
export class ProviderNotConfiguredError extends Error {
  code = "PROVIDER_NOT_CONFIGURED";
  constructor(public provider: ProviderId) {
    super(`No API key configured for ${provider}. Add one in Settings or set the environment variable.`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** The model declined to answer. Not retried on the same model; the fallback model may still answer. */
export class ModelRefusalError extends Error {
  code = "MODEL_REFUSAL";
  constructor(model: string, detail?: string) {
    super(`${model} declined the request${detail ? `: ${detail}` : ""}.`);
    this.name = "ModelRefusalError";
  }
}
