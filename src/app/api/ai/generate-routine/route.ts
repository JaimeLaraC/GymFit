import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildUserContext } from "@/lib/ai-context";
import { AI_MODEL, hasOpenAIKey, openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const RoutinePayloadSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  type: z.enum(["ppl", "upper_lower", "full_body", "custom"]).optional(),
  daysPerWeek: z.number().int().min(2).max(7).optional(),
  durationMin: z.number().int().min(20).max(180).optional(),
  focus: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  if (!hasOpenAIKey)
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY no configurada. Añádela en .env.local para generar rutinas.",
      },
      { status: 503 }
    );

  const parsedBody = RoutinePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success)
    return NextResponse.json(
      {
        error: parsedBody.error.issues[0]?.message ?? "Payload inválido",
      },
      { status: 400 }
    );

  const {
    userId = "default-user",
    type = "ppl",
    daysPerWeek = 4,
    durationMin = 60,
    focus,
  } = parsedBody.data;

  const { systemPrompt, userSummary } = await buildUserContext(userId);
  const exercises = await prisma.exercise.findMany({
    where: { isAvoided: false },
    select: {
      id: true,
      name: true,
      primaryMuscle: true,
      pattern: true,
      equipment: true,
    },
  });

  const routinePrompt = `Genera una rutina de entrenamiento con estos parámetros:
- Tipo: ${type}
- Días/semana: ${daysPerWeek}
- Duración por sesión: ${durationMin} minutos
${focus ? `- Músculo prioritario: ${focus}` : ""}

Usa SOLO ejercicios de esta lista (incluye el ID exacto):
${JSON.stringify(exercises, null, 2)}

Responde en JSON con este formato exacto:
{
  "name": "nombre del programa",
  "routines": [
    {
      "name": "nombre del día",
      "dayOfWeek": 1,
      "exercises": [
        {
          "exerciseId": "id-exacto",
          "order": 1,
          "targetSets": 3,
          "targetMinReps": 6,
          "targetMaxReps": 10,
          "targetRIR": 2,
          "restSeconds": 120,
          "method": "standard"
        }
      ]
    }
  ]
}

Asegúrate de:
- Repartir volumen equitativamente por músculo
- Incluir compound + aislamiento
- Series efectivas por músculo: 10-20/semana
- Ordenar de compound a aislamiento`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${userSummary}` },
      { role: "user", content: routinePrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  try {
    const routine = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    return NextResponse.json(routine);
  } catch {
    return NextResponse.json(
      { error: "Error parseando la rutina generada por la IA" },
      { status: 500 }
    );
  }
}
