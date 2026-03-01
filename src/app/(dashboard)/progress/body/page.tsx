import Link from "next/link";
import { WeightChart } from "@/components/charts/weight-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateE1RM } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { calculateEMA, detectRecomposition } from "@/lib/smoothing";

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

function formatDelta(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export default async function BodyMetricsPage() {
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { date: "desc" },
    take: 90,
  });

  const weightEntries = [...metrics]
    .filter((metric) => metric.weightKg !== null)
    .map((metric) => ({
      date: metric.date,
      weightKg: metric.weightKg as number,
    }))
    .reverse();

  const emaValues = calculateEMA(weightEntries.map((entry) => entry.weightKg), 0.1);
  const weightChartData = weightEntries.map((entry, index) => ({
    date: entry.date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    weight: entry.weightKg,
    smoothed: emaValues[index] ?? entry.weightKg,
  }));

  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weightKg : null;
  const currentSmoothed = emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const oldestRecent = weightEntries.find((entry) => entry.date >= fourWeeksAgo) ?? weightEntries[0];
  const weightDelta =
    currentWeight !== null && oldestRecent ? currentWeight - oldestRecent.weightKg : 0;

  const sessions = await prisma.session.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      status: "completed",
      workoutSets: { some: {} },
    },
    orderBy: { date: "asc" },
    include: {
      workoutSets: {
        select: {
          weight: true,
          reps: true,
        },
      },
    },
  });

  const weeklyStrength = new Map<string, number[]>();
  for (const session of sessions) {
    const weekStart = new Date(session.date);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);

    if (!weeklyStrength.has(key)) weeklyStrength.set(key, []);
    const maxE1rm = Math.max(...session.workoutSets.map((set) => calculateE1RM(set.weight, set.reps)));
    weeklyStrength.get(key)?.push(maxE1rm);
  }

  const e1rmTrends = [...weeklyStrength.entries()].map(([week, e1rms], index) => ({
    week: index,
    avgE1rm: e1rms.reduce((sum, item) => sum + item, 0) / e1rms.length,
    key: week,
  }));

  const recomposition = detectRecomposition(
    weightEntries.map((entry) => ({ date: entry.date, weightKg: entry.weightKg })),
    e1rmTrends.map((item) => ({ week: item.week, avgE1rm: item.avgE1rm }))
  );

  const latest = metrics[0] ?? null;
  const previous = metrics[1] ?? null;

  const measureRows = [
    { label: "Pecho", current: latest?.chestCm, previous: previous?.chestCm, unit: "cm" },
    { label: "Cintura", current: latest?.waistCm, previous: previous?.waistCm, unit: "cm" },
    { label: "Cadera", current: latest?.hipsCm, previous: previous?.hipsCm, unit: "cm" },
    { label: "Hombros", current: latest?.shouldersCm, previous: previous?.shouldersCm, unit: "cm" },
    { label: "Brazo izq.", current: latest?.leftArmCm, previous: previous?.leftArmCm, unit: "cm" },
    { label: "Brazo der.", current: latest?.rightArmCm, previous: previous?.rightArmCm, unit: "cm" },
    { label: "Muslo izq.", current: latest?.leftThighCm, previous: previous?.leftThighCm, unit: "cm" },
    { label: "Muslo der.", current: latest?.rightThighCm, previous: previous?.rightThighCm, unit: "cm" },
    { label: "Gemelo", current: latest?.calfCm, previous: previous?.calfCm, unit: "cm" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Métricas corporales</h1>
        <Button asChild size="sm">
          <Link href="/progress/body/add">+ Añadir medición</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Peso actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-end gap-3">
            <p className="font-mono text-4xl font-bold text-primary">
              {currentWeight !== null ? currentWeight.toFixed(1) : "—"}
            </p>
            <p className="text-sm text-muted-foreground pb-1">kg</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Suavizado EMA: {currentSmoothed !== null ? `${currentSmoothed.toFixed(1)} kg` : "—"} ·
            Delta 4 semanas: {formatDelta(weightDelta)} kg
          </p>
          {recomposition.isRecomposition ? (
            <Badge className="bg-green-500 hover:bg-green-500 text-white">Recomposición detectada</Badge>
          ) : (
            <Badge variant="outline">{recomposition.message}</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tendencia de peso (90 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {weightChartData.length > 0 ? (
            <WeightChart data={weightChartData} />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin datos de peso todavía.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimas medidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {measureRows.map((row) => {
            if (row.current === null || row.current === undefined) return null;

            const delta =
              row.previous === null || row.previous === undefined
                ? null
                : row.current - row.previous;

            return (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2"
              >
                <p className="text-sm text-muted-foreground">{row.label}</p>
                <div className="text-right">
                  <p className="font-mono text-sm">
                    {row.current.toFixed(1)} {row.unit}
                  </p>
                  {delta !== null ? (
                    <p className="text-[11px] text-muted-foreground">{formatDelta(delta)} {row.unit}</p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {measureRows.every((row) => row.current === null || row.current === undefined) ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No hay medidas registradas.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {metrics.slice(0, 12).map((metric) => (
            <div
              key={metric.id}
              className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2"
            >
              <p className="text-sm text-muted-foreground">
                {metric.date.toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                })}
              </p>
              <p className="font-mono text-sm">
                {metric.weightKg !== null ? `${metric.weightKg.toFixed(1)} kg` : "—"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
