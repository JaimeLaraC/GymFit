import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTargets } from "@/lib/nutrition-targets";
import { prisma } from "@/lib/prisma";
import { MacroTrendChartPanel } from "./macro-trend-chart-panel";

interface DailyNutritionPoint {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface WeeklySummaryPoint {
  week: string;
  avgCalories: number;
  avgProtein: number;
  adherence: number;
}

export const dynamic = "force-dynamic";

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export default async function NutritionTrendsPage() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  fourWeeksAgo.setHours(0, 0, 0, 0);

  const [meals, user, latestWeight] = await Promise.all([
    prisma.meal.findMany({
      where: {
        userId: "default-user",
        date: { gte: fourWeeksAgo },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: "default-user" },
      select: { goal: true },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId: "default-user", weightKg: { not: null } },
      orderBy: { date: "desc" },
      select: { weightKg: true },
    }),
  ]);

  const targets = calculateTargets(latestWeight?.weightKg ?? 75, user?.goal ?? "hypertrophy");

  const dailyMap = new Map<string, DailyNutritionPoint>();
  const cursor = new Date(fourWeeksAgo);
  while (cursor <= today) {
    const dateKey = getDateKey(cursor);
    dailyMap.set(dateKey, {
      date: formatDateLabel(cursor),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const meal of meals) {
    const dateKey = getDateKey(meal.date);
    const day = dailyMap.get(dateKey);
    if (!day) continue;
    day.calories += meal.calories ?? 0;
    day.protein += meal.proteinG ?? 0;
    day.carbs += meal.carbsG ?? 0;
    day.fat += meal.fatG ?? 0;
  }

  const dailyData = [...dailyMap.values()];

  const weeklyMap = new Map<
    string,
    {
      weekLabel: string;
      calories: number[];
      protein: number[];
      adherenceHits: number;
      days: number;
    }
  >();

  for (const [index, day] of dailyData.entries()) {
    const sourceDate = new Date(fourWeeksAgo);
    sourceDate.setDate(sourceDate.getDate() + index);

    const weekStart = getWeekStart(sourceDate);
    const weekKey = getDateKey(weekStart);
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        weekLabel: formatDateLabel(weekStart),
        calories: [],
        protein: [],
        adherenceHits: 0,
        days: 0,
      });
    }

    const week = weeklyMap.get(weekKey);
    if (!week) continue;
    week.calories.push(day.calories);
    week.protein.push(day.protein);
    week.days += 1;

    const isCalorieOnTarget =
      day.calories >= targets.calories * 0.9 && day.calories <= targets.calories * 1.1;
    const isProteinOnTarget = day.protein >= targets.proteinG * 0.9;
    if (isCalorieOnTarget && isProteinOnTarget) week.adherenceHits += 1;
  }

  const weeklySummary: WeeklySummaryPoint[] = [...weeklyMap.values()].map((week) => {
    const avgCalories =
      week.calories.length > 0
        ? week.calories.reduce((sum, value) => sum + value, 0) / week.calories.length
        : 0;
    const avgProtein =
      week.protein.length > 0
        ? week.protein.reduce((sum, value) => sum + value, 0) / week.protein.length
        : 0;
    const adherence = week.days > 0 ? Math.round((week.adherenceHits / week.days) * 100) : 0;

    return {
      week: week.weekLabel,
      avgCalories: round(avgCalories),
      avgProtein: round(avgProtein),
      adherence,
    };
  });

  const averageProtein = round(
    dailyData.length > 0
      ? dailyData.reduce((sum, day) => sum + day.protein, 0) / dailyData.length
      : 0
  );
  const averageCalories = round(
    dailyData.length > 0
      ? dailyData.reduce((sum, day) => sum + day.calories, 0) / dailyData.length
      : 0
  );
  const adherenceAverage = round(
    weeklySummary.length > 0
      ? weeklySummary.reduce((sum, week) => sum + week.adherence, 0) / weeklySummary.length
      : 0
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Tendencias Nutricionales</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Macros diarios (4 semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-[300px] animate-pulse rounded-lg bg-muted" />}>
            <MacroTrendChartPanel data={dailyData} calorieTarget={targets.calories} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumen semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {weeklySummary.map((week) => (
            <div
              key={week.week}
              className="grid grid-cols-4 gap-2 rounded-md border border-border/80 px-3 py-2 text-center"
            >
              <div>
                <p className="text-xs text-muted-foreground">Semana</p>
                <p className="font-mono text-sm">{week.week}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">kcal prom</p>
                <p className="font-mono text-sm">{week.avgCalories}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">prot prom</p>
                <p className="font-mono text-sm">{week.avgProtein}g</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">adherencia</p>
                <p className="font-mono text-sm">{week.adherence}%</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Proteína media: <span className="font-mono text-foreground">{averageProtein}g</span> / objetivo{" "}
            <span className="font-mono text-foreground">{targets.proteinG}g</span>
          </p>
          <p>
            Calorías medias: <span className="font-mono text-foreground">{averageCalories}</span> / objetivo{" "}
            <span className="font-mono text-foreground">{targets.calories}</span>
          </p>
          <p>
            Adherencia global: <span className="font-mono text-foreground">{adherenceAverage}%</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
