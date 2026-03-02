import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyFallback } from "@/lib/recovery-fallback";

const recoverySchema = z.object({
  userId: z.string().trim().min(1).default("default-user"),
  hrvMs: z.number().positive().nullable().optional(),
  restingHrBpm: z.number().int().positive().nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  steps: z.number().int().min(0).nullable().optional(),
  activeEnergyKcal: z.number().min(0).nullable().optional(),
  spo2: z.number().min(0).max(100).nullable().optional(),
  bodyTemperature: z.number().min(30).max(45).nullable().optional(),
  respiratoryRate: z.number().min(5).max(60).nullable().optional(),
  subjectiveEnergy: z.number().int().min(1).max(10).nullable().optional(),
  stressLevel: z.number().int().min(1).max(10).nullable().optional(),
});

const RECOVERY_FIELDS: (keyof z.infer<typeof recoverySchema>)[] = [
  "hrvMs",
  "restingHrBpm",
  "sleepHours",
  "steps",
  "activeEnergyKcal",
  "spo2",
  "bodyTemperature",
  "respiratoryRate",
  "subjectiveEnergy",
  "stressLevel",
];

function validateBearerToken(request: NextRequest): boolean {
  const configuredToken = process.env.API_TOKEN;
  if (!configuredToken) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return authHeader.slice(7) === configuredToken;
}

function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = recoverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hasAnyMetric = RECOVERY_FIELDS.some((field) => parsed.data[field] !== undefined);
  if (!hasAnyMetric)
    return NextResponse.json(
      { error: "Debes enviar al menos una métrica de recuperación" },
      { status: 400 }
    );

  const today = getTodayDate();
  const filledData = await applyFallback(parsed.data.userId, {
    hrvMs: parsed.data.hrvMs,
    restingHrBpm: parsed.data.restingHrBpm,
    sleepHours: parsed.data.sleepHours,
    steps: parsed.data.steps,
    activeEnergyKcal: parsed.data.activeEnergyKcal,
    spo2: parsed.data.spo2,
    bodyTemperature: parsed.data.bodyTemperature,
    respiratoryRate: parsed.data.respiratoryRate,
    subjectiveEnergy: parsed.data.subjectiveEnergy,
    stressLevel: parsed.data.stressLevel,
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
      source: "shortcut",
    },
    create: {
      userId: parsed.data.userId,
      date: today,
      ...filledData,
      source: "shortcut",
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const limit = Number(searchParams.get("limit") || "30");

  const snapshots = await prisma.recoverySnapshot.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: Number.isNaN(limit) ? 30 : Math.max(1, Math.min(limit, 90)),
  });

  return NextResponse.json(snapshots);
}
