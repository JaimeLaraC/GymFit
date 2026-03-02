import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyFallback } from "@/lib/recovery-fallback";

const manualSchema = z.object({
  userId: z.string().trim().min(1).default("default-user"),
  subjectiveEnergy: z.number().int().min(1).max(10),
  stressLevel: z.number().int().min(1).max(10).nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
});

function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const today = getTodayDate();
  const filledData = await applyFallback(parsed.data.userId, {
    subjectiveEnergy: parsed.data.subjectiveEnergy,
    stressLevel: parsed.data.stressLevel ?? null,
    sleepHours: parsed.data.sleepHours ?? null,
  });

  const snapshot = await prisma.recoverySnapshot.upsert({
    where: {
      userId_date: {
        userId: parsed.data.userId,
        date: today,
      },
    },
    update: {
      ...filledData,
      source: "manual",
    },
    create: {
      userId: parsed.data.userId,
      date: today,
      ...filledData,
      source: "manual",
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
