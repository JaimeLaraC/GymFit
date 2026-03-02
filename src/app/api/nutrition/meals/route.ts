import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const mealSchema = z.object({
  userId: z.string().trim().min(1).default("default-user"),
  description: z.string().trim().min(1, "La descripción es obligatoria"),
  calories: z.number().positive().optional(),
  proteinG: z.number().min(0).optional(),
  carbsG: z.number().min(0).optional(),
  fatG: z.number().min(0).optional(),
  fiberG: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function parseDate(dateString: string | null): Date {
  if (!dateString) return new Date();
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function getDayRange(date: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = mealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const meal = await prisma.meal.create({
    data: {
      userId: parsed.data.userId,
      description: parsed.data.description,
      date: new Date(),
      calories: parsed.data.calories ?? null,
      proteinG: parsed.data.proteinG ?? null,
      carbsG: parsed.data.carbsG ?? null,
      fatG: parsed.data.fatG ?? null,
      fiberG: parsed.data.fiberG ?? null,
      notes: parsed.data.notes ?? null,
      source: "manual",
      verified: true,
    },
  });

  return NextResponse.json(meal, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const date = parseDate(searchParams.get("date"));
  const { startOfDay, endOfDay } = getDayRange(date);

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { date: "asc" },
  });

  const totals = {
    calories: meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0),
    proteinG: meals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0),
    carbsG: meals.reduce((sum, meal) => sum + (meal.carbsG ?? 0), 0),
    fatG: meals.reduce((sum, meal) => sum + (meal.fatG ?? 0), 0),
    fiberG: meals.reduce((sum, meal) => sum + (meal.fiberG ?? 0), 0),
  };

  return NextResponse.json({ meals, totals });
}
