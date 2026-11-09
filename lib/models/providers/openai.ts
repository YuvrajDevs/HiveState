import OpenAI from "openai";
import type { GenerateRequest, GenerateResult, Provider } from "../types";

export function createOpenAIProvider(apiKey: string, baseURL?: string | null): Provider {
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined, maxRetries: 0 }); // retries are ours
  return {
    id: "openai",
    async generate({ model, system, prompt, signal, onDelta, maxOutputTokens }: GenerateRequest): Promise<GenerateResult> {
      const stream = await client.chat.completions.create(
        {
          model,
          stream: true,
          stream_options: { include_usage: true },
          max_completion_tokens: maxOutputTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
        { signal },
      );
      let text = "";
      let inputTokens = 0;
      let outputTokens = 0;
      for await (const chunk of stream) {
        const piece = chunk.choices[0]?.delta?.content;
        if (piece) {
          text += piece;
          onDelta?.(piece);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }
      return { text, inputTokens, outputTokens };
    },
  };
}
