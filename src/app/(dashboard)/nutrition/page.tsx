import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { DailyNutrition } from "./daily-nutrition";

interface NutritionTargetSnapshot {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  label: string;
}

export const dynamic = "force-dynamic";

function calculateBaselineTargets(weightKg: number): NutritionTargetSnapshot {
  return {
    calories: Math.round(weightKg * 30),
    proteinG: Math.round(weightKg * 2),
    carbsG: Math.round(weightKg * 3.5),
    fatG: Math.round(weightKg * 0.9),
    fiberG: 30,
    label: "Objetivo base",
  };
}

export default async function NutritionPage() {
  const [user, latestWeight, todayMeals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: "default-user" },
      select: { goal: true },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId: "default-user", weightKg: { not: null } },
      orderBy: { date: "desc" },
      select: { weightKg: true },
    }),
    prisma.meal.findMany({
      where: {
        userId: "default-user",
        date: {
          gte: (() => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            return date;
          })(),
          lte: (() => {
            const date = new Date();
            date.setHours(23, 59, 59, 999);
            return date;
          })(),
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const weight = latestWeight?.weightKg ?? 75;
  const targets = calculateBaselineTargets(weight);

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
      <DailyNutrition meals={todayMeals} targets={targets} goal={user?.goal ?? "hypertrophy"} />
    </Suspense>
  );
}
