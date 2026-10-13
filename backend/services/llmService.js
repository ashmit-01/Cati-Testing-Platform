
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function generateWithGemini(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return response.text;
}