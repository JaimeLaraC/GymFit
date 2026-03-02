import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AI_MODEL, hasOpenAIKey, openai } from "@/lib/openai";

interface NutritionAnalysis {
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_DIRECTORY = join(process.cwd(), "public", "uploads", "meals");

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeAnalysis(raw: unknown): NutritionAnalysis {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const confidence = record.confidence;

  return {
    description:
      typeof record.description === "string" && record.description.trim().length > 0
        ? record.description.trim()
        : null,
    calories: toNumberOrNull(record.calories),
    proteinG: toNumberOrNull(record.proteinG),
    carbsG: toNumberOrNull(record.carbsG),
    fatG: toNumberOrNull(record.fatG),
    fiberG: toNumberOrNull(record.fiberG),
    confidence: confidence === "high" || confidence === "low" ? confidence : "medium",
    notes:
      typeof record.notes === "string" && record.notes.trim().length > 0
        ? record.notes.trim()
        : null,
  };
}

function inferExtension(fileName: string, mimeType: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension) return extension;

  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const userId = String(formData.get("userId") || "default-user");

  if (!(file instanceof File))
    return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });

  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "El archivo debe ser una imagen válida" }, { status: 400 });

  if (file.size > MAX_FILE_SIZE_BYTES)
    return NextResponse.json({ error: "La imagen supera el máximo de 10MB" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const extension = inferExtension(file.name, file.type);
  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;

  await mkdir(UPLOAD_DIRECTORY, { recursive: true });
  await writeFile(join(UPLOAD_DIRECTORY, filename), buffer);

  const photoUrl = `/uploads/meals/${filename}`;

  if (!hasOpenAIKey) {
    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(),
        photoUrl,
        source: "ai_photo",
        verified: false,
      },
    });

    return NextResponse.json(
      {
        meal,
        error: "OPENAI_API_KEY no configurada. La foto se guardó para completar macros manualmente.",
      },
      { status: 201 }
    );
  }

  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `Eres un nutricionista experto. Analiza la foto de comida y estima valores nutricionales.
Responde SOLO en JSON con este formato:
{"description":"string","calories":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"confidence":"high|medium|low","notes":"string"}
Sé conservador y usa confidence:"low" si hay incertidumbre alta.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta comida." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.2,
    });

    const parsedAnalysis = normalizeAnalysis(
      JSON.parse(response.choices[0]?.message?.content || "{}")
    );

    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(),
        photoUrl,
        description: parsedAnalysis.description,
        calories: parsedAnalysis.calories,
        proteinG: parsedAnalysis.proteinG,
        carbsG: parsedAnalysis.carbsG,
        fatG: parsedAnalysis.fatG,
        fiberG: parsedAnalysis.fiberG,
        notes: parsedAnalysis.notes,
        source: "ai_photo",
        verified: false,
      },
    });

    return NextResponse.json({ meal, analysis: parsedAnalysis }, { status: 201 });
  } catch (error) {
    console.error("Nutrition analyze error:", error);

    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(),
        photoUrl,
        source: "ai_photo",
        verified: false,
      },
    });

    return NextResponse.json(
      {
        meal,
        error: "Error al analizar la foto. Puedes completar los macros manualmente.",
      },
      { status: 201 }
    );
  }
}
