import { describe, expect, it, vi } from "vitest";
import { createModelHub } from "@/lib/models/hub";
import { ModelRefusalError, ProviderNotConfiguredError } from "@/lib/models/types";

const ok = (text: string) => ({ text, inputTokens: 1, outputTokens: 1 });

describe("model hub", () => {
  it("routes each model to its provider", async () => {
    const seen: string[] = [];
    const hub = createModelHub({
      credentials: async () => ({ apiKey: "k" }),
      providerFactory: (id) => ({ id, generate: async (r) => (seen.push(`${id}:${r.model}`), ok("x")) }),
    });
    for (const model of ["gemini-2.5-flash", "gpt-5-mini", "claude-opus-5-5"]) await hub.call({ model, system: "s", prompt: "p" });
    expect(seen).toEqual(["gemini:gemini-2.5-flash", "openai:gpt-5-mini", "anthropic:claude-opus-5-5"]);
  });

  it("falls back when the primary provider has no key", async () => {
    const hub = createModelHub({
      credentials: async (p) => (p === "anthropic" ? null : { apiKey: "k" }),
      providerFactory: (id) => ({ id, generate: async () => ok(id) }),
    });
    const res = await hub.call({ model: "claude-sonnet-5-5", fallbackModel: "gemini-2.5-flash", system: "s", prompt: "p" });
    expect(res).toMatchObject({ text: "gemini", modelUsed: "gemini-2.5-flash", isFallback: true });
    await expect(hub.call({ model: "claude-sonnet-5-5", system: "s", prompt: "p" })).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("falls back on a refusal without retrying the same model", async () => {
    const generate = vi.fn(async (r: { model: string }) => {
      if (r.model.startsWith("claude")) throw new ModelRefusalError(r.model);
      return ok("fallback answer");
    });
    const hub = createModelHub({ credentials: async () => ({ apiKey: "k" }), providerFactory: (id) => ({ id, generate }) });
    const res = await hub.call({ model: "claude-opus-5-5", fallbackModel: "gpt-5-mini", system: "s", prompt: "p", retries: 3 });
    expect(res.modelUsed).toBe("gpt-5-mini");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("uses the offline mock provider when forced", async () => {
    const hub = createModelHub({ credentials: async () => null, providerFactory: () => { throw new Error("unused"); }, forceMock: true });
    const deltas: string[] = [];
    const res = await hub.call({ model: "claude-opus-5-5", system: "Summariser. Be brief", prompt: "hello", onDelta: (d) => deltas.push(d) });
    expect(res.text).toContain("hello");
    expect(deltas.join("")).toBe(res.text);
  });
});
