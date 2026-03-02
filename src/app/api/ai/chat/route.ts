import { NextRequest } from "next/server";
import { z } from "zod";
import { buildUserContext } from "@/lib/ai-context";
import { AI_MODEL, hasOpenAIKey, openai } from "@/lib/openai";

const ChatPayloadSchema = z.object({
  message: z.string().trim().min(1, "message es requerido"),
  userId: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const parsedBody = ChatPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({
        error: parsedBody.error.issues[0]?.message ?? "Payload inválido",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!hasOpenAIKey) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY no configurada. Añádela en .env.local para usar el chat.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { message, userId = "default-user" } = parsedBody.data;
  const { systemPrompt, userSummary } = await buildUserContext(userId);

  const stream = await openai.chat.completions.create({
    model: AI_MODEL,
    stream: true,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${userSummary}` },
      { role: "user", content: message },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (!text) continue;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error inesperado durante el streaming";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
