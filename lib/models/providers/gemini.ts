import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateRequest, GenerateResult, Provider } from "../types";

export function createGeminiProvider(apiKey: string): Provider {
  const client = new GoogleGenerativeAI(apiKey);
  return {
    id: "gemini",
    async generate({ model, system, prompt, signal, onDelta, maxOutputTokens }: GenerateRequest): Promise<GenerateResult> {
      const m = client.getGenerativeModel({
        model,
        systemInstruction: system,
        generationConfig: maxOutputTokens ? { maxOutputTokens } : undefined,
      });
      const result = await m.generateContentStream(prompt, { signal });
      let text = "";
      for await (const chunk of result.stream) {
        const piece = chunk.text();
        if (piece) {
          text += piece;
          onDelta?.(piece);
        }
      }
      const response = await result.response;
      const usage = response.usageMetadata;
      return {
        text,
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
      };
    },
  };
}
