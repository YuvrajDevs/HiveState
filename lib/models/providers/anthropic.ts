import Anthropic from "@anthropic-ai/sdk";
import { ModelRefusalError, type GenerateRequest, type GenerateResult, type Provider } from "../types";

export function createAnthropicProvider(apiKey: string, baseURL?: string | null): Provider {
  const client = new Anthropic({ apiKey, baseURL: baseURL || undefined, maxRetries: 0 }); // retries are ours
  return {
    id: "anthropic",
    async generate({ model, system, prompt, signal, onDelta, maxOutputTokens }: GenerateRequest): Promise<GenerateResult> {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: maxOutputTokens || 16000,
          system,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      );
      stream.on("text", (delta) => onDelta?.(delta));
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        throw new ModelRefusalError(model);
      }
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        inputTokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens || 0) + (message.usage.cache_creation_input_tokens || 0),
        outputTokens: message.usage.output_tokens,
      };
    },
  };
}
