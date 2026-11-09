import { describe, expect, it } from "vitest";
import { estimateRunCost, DEFAULT_OUTPUT_TOKENS } from "@/lib/engine/estimate";
import { costInr, providerFor, resolveModelId } from "@/lib/models/catalog";
import { agent, canvas } from "../helpers";

describe("model catalogue", () => {
  it("routes model ids to providers and aliases retired ids", () => {
    expect(providerFor("claude-opus-5-5")).toBe("anthropic");
    expect(providerFor("gpt-5-mini")).toBe("openai");
    expect(providerFor("gemini-2.5-pro")).toBe("gemini");
    expect(providerFor("claude-something-new")).toBe("anthropic");
    expect(resolveModelId("gemini-1.5-flash")).toBe("gemini-2.5-flash-lite");
  });

  it("prices tokens in INR", () => {
    // claude-haiku-5-5: $0.10 in / $0.50 out per 1M
    expect(costInr("claude-haiku-5-5", 1_000_000, 1_000_000)).toBeCloseTo(0.6 * 88, 6);
    expect(costInr("mock-echo", 1_000_000, 1_000_000)).toBe(0);
  });
});

describe("cost estimate", () => {
  it("chains output tokens into downstream inputs and skips review steps", () => {
    const c = canvas([agent("a", { systemPrompt: "x".repeat(400) }), agent("r", {}, "HITLNode"), agent("b", { systemPrompt: "" })], [["a", "r"], ["r", "b"]]);
    const est = estimateRunCost(c, "y".repeat(4000));
    expect(est.nodes.map((n) => n.nodeId)).toEqual(["a", "b"]);
    expect(est.nodes[0].inputTokens).toBe(1000 + 100);
    expect(est.nodes[1].inputTokens).toBe(DEFAULT_OUTPUT_TOKENS);
    expect(est.low).toBeLessThan(est.expected);
    expect(est.high).toBeGreaterThan(est.expected);
  });

  it("counts variable values in the estimate", () => {
    const c = canvas([agent("a", { systemPrompt: "{{doc}}" })], []);
    const small = estimateRunCost(c, "x", { doc: "a" });
    const big = estimateRunCost(c, "x", { doc: "a".repeat(40_000) });
    expect(big.inputTokens - small.inputTokens).toBeGreaterThan(9000);
  });
});
