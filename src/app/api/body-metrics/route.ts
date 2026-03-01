import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BodyMetricPayload {
  userId?: string;
  weightKg?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
  calfCm?: number | null;
  shouldersCm?: number | null;
  notes?: string | null;
}

const DEFAULT_USER_ID = "default-user";

const METRIC_FIELDS: (keyof Omit<BodyMetricPayload, "userId" | "notes">)[] = [
  "weightKg",
  "chestCm",
  "waistCm",
  "hipsCm",
  "leftArmCm",
  "rightArmCm",
  "leftThighCm",
  "rightThighCm",
  "calfCm",
  "shouldersCm",
];

function normalizeNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function normalizeText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;
    const limit = Number(searchParams.get("limit") ?? 30);

    const metrics = await prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: Number.isNaN(limit) ? 30 : limit,
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching body metrics:", error);
    return NextResponse.json(
      { error: "Error interno al obtener métricas corporales" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: BodyMetricPayload = await request.json();
    const userId = body.userId ?? DEFAULT_USER_ID;

    const parsedPayload = {
      weightKg: normalizeNumber(body.weightKg),
      chestCm: normalizeNumber(body.chestCm),
      waistCm: normalizeNumber(body.waistCm),
      hipsCm: normalizeNumber(body.hipsCm),
      leftArmCm: normalizeNumber(body.leftArmCm),
      rightArmCm: normalizeNumber(body.rightArmCm),
      leftThighCm: normalizeNumber(body.leftThighCm),
      rightThighCm: normalizeNumber(body.rightThighCm),
      calfCm: normalizeNumber(body.calfCm),
      shouldersCm: normalizeNumber(body.shouldersCm),
      notes: normalizeText(body.notes),
    };

    const hasAnyMetric = METRIC_FIELDS.some((field) => {
      const value = parsedPayload[field];
      return typeof value === "number";
    });

    if (!hasAnyMetric) {
      return NextResponse.json(
        { error: "Debes incluir al menos una métrica numérica" },
        { status: 400 }
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const existing = await prisma.bodyMetric.findFirst({
      where: {
        userId,
        date: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.bodyMetric.update({
        where: { id: existing.id },
        data: parsedPayload,
      });
      return NextResponse.json(updated);
    }

    const created = await prisma.bodyMetric.create({
      data: {
        userId,
        date: todayStart,
        ...parsedPayload,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating body metric:", error);
    return NextResponse.json(
      { error: "Error interno al guardar métricas corporales" },
      { status: 500 }
    );
  }
}
