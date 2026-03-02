import OpenAI from "openai";

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
export const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "missing-openai-api-key",
});
