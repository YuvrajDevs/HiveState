import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing env.GEMINI_API_KEY. Please add it to your .env.local");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Optimized for low-latency agent execution.
 * Default model is gemini-2.5-flash.
 */
export async function generateGeminiOutcome(
  systemPrompt: string,
  userPrompt: string,
  modelName: string = "gemini-2.5-flash",
  retries: number = 3
) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      const response = await result.response;
      
      return {
        text: response.text(),
        usageMetadata: response.usageMetadata
      };
    } catch (err: any) {
      const errorMsg = err.message || "";
      const isRetryable = errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("overloaded") || errorMsg.includes("high demand");
      
      if (isRetryable && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 100;
        console.warn(`🔄 Gemini API Resilience: Attempt ${attempt + 1} failed (503/429). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw err;
    }
  }

  throw new Error("Model execution failed after multiple retry attempts.");
}
