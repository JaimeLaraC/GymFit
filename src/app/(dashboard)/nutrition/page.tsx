import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { calculateTargets } from "@/lib/nutrition-targets";
import { DailyNutrition } from "./daily-nutrition";

export const dynamic = "force-dynamic";

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
  const targets = calculateTargets(weight, user?.goal ?? "hypertrophy");

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
      <DailyNutrition meals={todayMeals} targets={targets} goal={user?.goal ?? "hypertrophy"} />
    </Suspense>
  );
}
