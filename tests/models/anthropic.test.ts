import { describe, expect, it, vi } from "vitest";

// Stand-in for the SDK's MessageStream: emits text events, then resolves the final message.
const state = vi.hoisted(() => ({ stopReason: "end_turn", lastParams: null as unknown }));
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      stream: (params: unknown) => {
        state.lastParams = params;
        const handlers: Array<(t: string) => void> = [];
        return {
          on: (_e: string, fn: (t: string) => void) => handlers.push(fn),
          finalMessage: async () => {
            handlers.forEach((fn) => { fn("Hel"); fn("lo"); });
            return {
              stop_reason: state.stopReason,
              content: [{ type: "text", text: "Hello" }],
              usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 0 },
            };
          },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

import { createAnthropicProvider } from "@/lib/models/providers/anthropic";
import { ModelRefusalError } from "@/lib/models/types";

describe("anthropic provider", () => {
  it("streams text and maps usage, counting cached input tokens", async () => {
    state.stopReason = "end_turn";
    const deltas: string[] = [];
    const res = await createAnthropicProvider("k").generate({ model: "claude-haiku-5-5", system: "sys", prompt: "hi", onDelta: (d) => deltas.push(d) });
    expect(res).toEqual({ text: "Hello", inputTokens: 12, outputTokens: 5 });
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(state.lastParams).toMatchObject({ model: "claude-haiku-5-5", system: "sys", messages: [{ role: "user", content: "hi" }] });
  });

  it("turns a refusal into a ModelRefusalError so the hub can fall back", async () => {
    state.stopReason = "refusal";
    await expect(createAnthropicProvider("k").generate({ model: "claude-opus-5-5", system: "s", prompt: "p" })).rejects.toBeInstanceOf(ModelRefusalError);
  });
});
