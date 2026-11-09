/** Retry with exponential backoff and full jitter, plus a hard per-attempt timeout via AbortSignal. */

export class TimeoutError extends Error {
  code = "TIMEOUT";
  constructor(ms: number) {
    super(`Step timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

export interface RetryOptions {
  /** Extra attempts after the first. 0 means a single attempt. */
  retries: number;
  timeoutMs: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP status from the various SDK error shapes (OpenAI/Anthropic `status`, Gemini message text). */
export function errorStatus(err: unknown): number | undefined {
  const e = err as { status?: unknown; statusCode?: unknown; message?: unknown };
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.statusCode === "number") return e.statusCode;
  const m = typeof e?.message === "string" ? e.message.match(/\[(\d{3})[^\]]*\]|\b(429|500|502|503|504)\b/) : null;
  if (m) return Number(m[1] || m[2]);
  return undefined;
}

/** Transient failures worth another attempt: rate limits, 5xx, timeouts and dropped connections. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  const status = errorStatus(err);
  if (status !== undefined) return status === 408 || status === 409 || status === 429 || status >= 500;
  const msg = String((err as { message?: unknown })?.message || "").toLowerCase();
  return /overloaded|high demand|econnreset|etimedout|socket hang up|fetch failed|network/.test(msg);
}

export function backoffDelay(attempt: number, base: number, max: number, random: () => number = Math.random): number {
  const cap = Math.min(max, base * 2 ** (attempt - 1));
  return Math.round(cap / 2 + random() * (cap / 2)); // "equal jitter": never zero, never above the cap
}

export async function withRetry<T>(fn: (signal: AbortSignal, attempt: number) => Promise<T>, opts: RetryOptions): Promise<RetryResult<T>> {
  const { retries, timeoutMs, baseDelayMs = 500, maxDelayMs = 8000, isRetryable = isTransientError, onRetry, sleep = defaultSleep, random } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutError(timeoutMs)); // settle the race first, so the abort's own error loses
          controller.abort();
        }, timeoutMs);
      });
      const work = fn(controller.signal, attempt);
      work.catch(() => undefined); // a timed-out attempt may reject later; that must not become an unhandled rejection
      const value = await Promise.race([work, timeout]);
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt > retries || !isRetryable(err)) {
        (err as { attempts?: number }).attempts = attempt;
        throw err;
      }
      const delayMs = backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError;
}
