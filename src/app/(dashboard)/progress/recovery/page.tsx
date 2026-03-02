import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { RecoveryChartPanel } from "./recovery-chart-panel";

interface RecoveryPageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

interface RecoveryMetricCard {
  title: string;
  value: string;
  avg: string;
  trend: "up" | "down" | "stable";
  colorClass: string;
}

export const dynamic = "force-dynamic";

function average(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function trendDirection(current: number | null, baseline: number | null): "up" | "down" | "stable" {
  if (current === null || baseline === null) return "stable";
  if (current > baseline * 1.03) return "up";
  if (current < baseline * 0.97) return "down";
  return "stable";
}

function trendBadge(trend: RecoveryMetricCard["trend"]): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function formatNullable(value: number | null, digits: number = 0): string {
  if (value === null) return "—";
  return value.toFixed(digits);
}

function toTrendColor(trend: RecoveryMetricCard["trend"]): string {
  if (trend === "up") return "text-green-500";
  if (trend === "down") return "text-red-500";
  return "text-muted-foreground";
}

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedDays = Number(resolvedSearchParams.days ?? "30");
  const days = Number.isNaN(requestedDays) ? 30 : Math.max(7, Math.min(requestedDays, 90));

  const snapshots = await prisma.recoverySnapshot.findMany({
    where: { userId: "default-user" },
    orderBy: { date: "desc" },
    take: days,
  });

  const latest = snapshots[0] ?? null;
  const last7 = snapshots.slice(0, 7);

  const hrvAvg7d = average(last7.map((item) => item.hrvMs));
  const restingHrAvg7d = average(last7.map((item) => (item.restingHrBpm === null ? null : Number(item.restingHrBpm))));
  const sleepAvg7d = average(last7.map((item) => item.sleepHours));
  const energyAvg7d = average(last7.map((item) => (item.subjectiveEnergy === null ? null : Number(item.subjectiveEnergy))));

  const hasRecentData = snapshots.length > 0;
  const isHRVDeclining =
    latest?.hrvMs !== null && hrvAvg7d !== null ? latest.hrvMs < hrvAvg7d * 0.85 : false;
  const isSleepLow = latest?.sleepHours !== null && latest.sleepHours < 6;

  const cards: RecoveryMetricCard[] = [
    {
      title: "HRV",
      value: latest?.hrvMs !== null && latest?.hrvMs !== undefined ? `${latest.hrvMs.toFixed(1)} ms` : "—",
      avg: hrvAvg7d !== null ? `${hrvAvg7d.toFixed(1)} ms` : "—",
      trend: trendDirection(latest?.hrvMs ?? null, hrvAvg7d),
      colorClass: "text-green-500",
    },
    {
      title: "FC reposo",
      value:
        latest?.restingHrBpm !== null && latest?.restingHrBpm !== undefined
          ? `${latest.restingHrBpm} bpm`
          : "—",
      avg: restingHrAvg7d !== null ? `${restingHrAvg7d.toFixed(1)} bpm` : "—",
      trend: trendDirection(
        latest?.restingHrBpm !== null && latest?.restingHrBpm !== undefined
          ? Number(latest.restingHrBpm)
          : null,
        restingHrAvg7d
      ),
      colorClass: "text-red-500",
    },
    {
      title: "Sueño",
      value:
        latest?.sleepHours !== null && latest?.sleepHours !== undefined
          ? `${latest.sleepHours.toFixed(1)} h`
          : "—",
      avg: sleepAvg7d !== null ? `${sleepAvg7d.toFixed(1)} h` : "—",
      trend: trendDirection(latest?.sleepHours ?? null, sleepAvg7d),
      colorClass: "text-blue-500",
    },
    {
      title: "Energía",
      value:
        latest?.subjectiveEnergy !== null && latest?.subjectiveEnergy !== undefined
          ? `${latest.subjectiveEnergy}/10`
          : "—",
      avg: energyAvg7d !== null ? `${energyAvg7d.toFixed(1)}/10` : "—",
      trend: trendDirection(
        latest?.subjectiveEnergy !== null && latest?.subjectiveEnergy !== undefined
          ? Number(latest.subjectiveEnergy)
          : null,
        energyAvg7d
      ),
      colorClass: "text-yellow-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Recuperación</h1>
        <Button asChild size="sm" variant="outline">
          <Link href="/progress/recovery/add">Registrar</Link>
        </Button>
      </div>

      {isHRVDeclining || isSleepLow ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-sm">
            {isHRVDeclining ? <p>⚠️ HRV por debajo de la media 7d. Considera reducir volumen hoy.</p> : null}
            {isSleepLow ? <p>⚠️ Sueño por debajo de 6h. Evita series al fallo.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`font-mono text-xl font-bold ${card.colorClass}`}>{card.value}</p>
              <p className={`text-xs ${toTrendColor(card.trend)}`}>
                {trendBadge(card.trend)} Media 7d: {card.avg}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tendencia fisiológica</CardTitle>
        </CardHeader>
        <CardContent>
          {hasRecentData ? (
            <Suspense fallback={<div className="h-[250px] animate-pulse rounded-lg bg-muted" />}>
              <RecoveryChartPanel
                data={snapshots.map((item) => ({
                  date: item.date.toISOString().slice(5, 10),
                  hrv: item.hrvMs,
                  restingHr: item.restingHrBpm === null ? null : Number(item.restingHrBpm),
                  sleep: item.sleepHours,
                }))}
              />
            </Suspense>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin datos todavía. Registra tu primer snapshot de recuperación.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {snapshots.slice(0, 7).map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2"
            >
              <div>
                <p className="text-sm">
                  {snapshot.date.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  HRV {formatNullable(snapshot.hrvMs, 1)} · FC{" "}
                  {snapshot.restingHrBpm !== null ? snapshot.restingHrBpm : "—"} · Sueño{" "}
                  {formatNullable(snapshot.sleepHours, 1)}
                </p>
              </div>
              <Badge variant={snapshot.source === "manual" ? "secondary" : "outline"}>
                {snapshot.source === "manual" ? "✏️ manual" : "⌚ shortcut"}
              </Badge>
            </div>
          ))}

          {snapshots.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No hay snapshots de recuperación todavía.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
