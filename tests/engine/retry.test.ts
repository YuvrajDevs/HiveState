import { describe, expect, it } from "vitest";
import { backoffDelay, errorStatus, isTransientError, TimeoutError, withRetry } from "@/lib/engine/retry";
import { httpError } from "../helpers";

const noSleep = async () => undefined;

describe("retry", () => {
  it("classifies transient errors", () => {
    expect(isTransientError(httpError(429))).toBe(true);
    expect(isTransientError(httpError(503))).toBe(true);
    expect(isTransientError(httpError(400))).toBe(false);
    expect(isTransientError(new TimeoutError(10))).toBe(true);
    expect(isTransientError(new Error("[GoogleGenerativeAI Error]: [503 Service Unavailable] overloaded"))).toBe(true);
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    expect(errorStatus(new Error("[429 Too Many Requests]"))).toBe(429);
  });

  it("backs off exponentially with bounded jitter", () => {
    expect(backoffDelay(1, 500, 8000, () => 0)).toBe(250);
    expect(backoffDelay(3, 500, 8000, () => 1)).toBe(2000);
    expect(backoffDelay(10, 500, 8000, () => 1)).toBe(8000);
  });

  it("retries until success and reports attempts", async () => {
    let n = 0;
    const delays: number[] = [];
    const res = await withRetry(async () => {
      if (++n < 3) throw httpError(500);
      return "ok";
    }, { retries: 3, timeoutMs: 1000, sleep: noSleep, onRetry: ({ delayMs }) => delays.push(delayMs) });
    expect(res).toEqual({ value: "ok", attempts: 3 });
    expect(delays).toHaveLength(2);
  });

  it("gives up after the retry budget and tags the error with attempts", async () => {
    const err = await withRetry(async () => { throw httpError(500); }, { retries: 2, timeoutMs: 1000, sleep: noSleep }).catch((e) => e);
    expect(err.attempts).toBe(3);
  });

  it("aborts the attempt on timeout", async () => {
    let aborted = false;
    const err = await withRetry(
      (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); })),
      { retries: 0, timeoutMs: 20, sleep: noSleep },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(aborted).toBe(true);
  });
});
