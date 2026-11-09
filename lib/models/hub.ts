import { providerFor, resolveModelId, type ProviderId } from "./catalog";
import { isTransientError, withRetry } from "../engine/retry";
import { ModelRefusalError, ProviderNotConfiguredError, type Provider } from "./types";
import { createMockProvider } from "./providers/mock";

/**
 * One entry point for every model call: picks the provider from the model ID, applies per-node
 * retries/timeouts, and falls back to a second model when the first is unavailable.
 * Framework-free and dependency-injected so the runner tests can use it with fake providers.
 */

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string | null;
}

export interface ModelCallOptions {
  model: string;
  fallbackModel?: string | null;
  system: string;
  prompt: string;
  retries?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
  onDelta?: (chunk: string) => void;
  /** A new attempt is starting; discard any partial streamed text from the previous one. */
  onAttemptStart?: (info: { model: string; attempt: number }) => void;
}

export interface ModelOutcome {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  isFallback: boolean;
  attempts: number;
}

export interface ModelHub {
  call(opts: ModelCallOptions): Promise<ModelOutcome>;
}

export interface ModelHubDeps {
  credentials: (provider: ProviderId) => Promise<ProviderCredentials | null>;
  providerFactory: (provider: ProviderId, creds: ProviderCredentials) => Provider;
  sleep?: (ms: number) => Promise<void>;
  /** Route every call to the offline mock provider. */
  forceMock?: boolean;
}

export const DEFAULT_RETRIES = 2;
export const DEFAULT_TIMEOUT_MS = 90_000;

/** Errors after which the fallback model is worth trying. */
function shouldFallBack(err: unknown) {
  return err instanceof ProviderNotConfiguredError || err instanceof ModelRefusalError || isTransientError(err);
}

export function createModelHub(deps: ModelHubDeps): ModelHub {
  const cache = new Map<string, Provider>();
  const mock = createMockProvider();

  async function providerForModel(model: string): Promise<Provider> {
    const pid = deps.forceMock ? "mock" : providerFor(model);
    if (pid === "mock") return mock;
    const creds = await deps.credentials(pid);
    if (!creds?.apiKey) throw new ProviderNotConfiguredError(pid);
    const key = `${pid}:${creds.apiKey.slice(-6)}:${creds.baseUrl || ""}`;
    if (!cache.has(key)) cache.set(key, deps.providerFactory(pid, creds));
    return cache.get(key)!;
  }

  async function attempt(model: string, opts: ModelCallOptions) {
    const provider = await providerForModel(model);
    return withRetry(
      (signal, n) => {
        opts.onAttemptStart?.({ model, attempt: n });
        return provider.generate({
          model,
          system: opts.system,
          prompt: opts.prompt,
          signal,
          onDelta: opts.onDelta,
          maxOutputTokens: opts.maxOutputTokens,
        });
      },
      {
        retries: Math.max(0, Math.min(opts.retries ?? DEFAULT_RETRIES, 5)),
        timeoutMs: Math.max(1000, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        sleep: deps.sleep,
        onRetry: ({ attempt: n, delayMs, error }) =>
          console.warn(`[models] ${model} attempt ${n} failed (${(error as Error)?.message}); retrying in ${delayMs} ms`),
      },
    );
  }

  return {
    async call(opts) {
      const primary = resolveModelId(opts.model);
      const fallback = opts.fallbackModel ? resolveModelId(opts.fallbackModel) : null;
      try {
        const { value, attempts } = await attempt(primary, opts);
        return { ...value, modelUsed: primary, isFallback: false, attempts };
      } catch (err) {
        if (!fallback || fallback === primary || !shouldFallBack(err)) throw err;
        console.warn(`[models] ${primary} unavailable (${(err as Error).message}); falling back to ${fallback}`);
        const prior = (err as { attempts?: number }).attempts || 1;
        const { value, attempts } = await attempt(fallback, opts);
        return { ...value, modelUsed: fallback, isFallback: true, attempts: prior + attempts };
      }
    },
  };
}
