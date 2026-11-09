import type { GenerateRequest, GenerateResult, Provider } from "../types";
import { approxTokens } from "../catalog";

/**
 * Deterministic offline provider (model id `mock-*`). Used by tests and for running
 * the app with no API keys (HIVESTATE_MOCK_LLM=1 routes every model here).
 */
export function createMockProvider(): Provider {
  return {
    id: "mock",
    async generate({ system, prompt, onDelta, signal }: GenerateRequest): Promise<GenerateResult> {
      const role = system.split(/[.\n]/)[0].slice(0, 80) || "Agent";
      const text = `[${role}]\n${prompt.slice(0, 400)}`;
      for (const word of text.split(/(\s+)/)) {
        if (signal?.aborted) throw new Error("aborted");
        onDelta?.(word);
      }
      return { text, inputTokens: approxTokens(system + prompt), outputTokens: approxTokens(text) };
    },
  };
}
