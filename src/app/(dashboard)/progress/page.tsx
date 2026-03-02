import Image from "next/image";
import Link from "next/link";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { VolumeChart } from "@/components/charts/volume-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import { ScoreCard } from "@/components/score-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateE1RM, calculateVolume } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { calculateScore } from "@/lib/score";
import { calculateEMA, detectRecomposition } from "@/lib/smoothing";

interface WeeklyAggregate {
  key: string;
  week: string;
  volume: number;
  effectiveSets: number;
  totalSets: number;
  sessions: number;
  e1rms: number[];
}

interface ExerciseBest {
  exerciseId: string;
  exerciseName: string;
  bestE1rm: number;
}

interface ProgressPrItem {
  date: Date;
  exerciseName: string;
  type: "weight" | "reps" | "e1rm" | "volume";
  value: number;
}

const DEFAULT_USER_ID = "default-user";

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  lateral_delts: "Deltoides L",
  rear_delts: "Deltoides P",
  quads: "Cuádriceps",
  hamstrings: "Isquios",
  glutes: "Glúteos",
  biceps: "Bíceps",
  triceps: "Tríceps",
  calves: "Gemelos",
  abs: "Core",
  traps: "Trapecios",
  forearms: "Antebrazos",
};

export const dynamic = "force-dynamic";

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatPrType(type: ProgressPrItem["type"]): string {
  if (type === "weight") return "Peso";
  if (type === "reps") return "Reps";
  if (type === "e1rm") return "e1RM";
  return "Volumen";
}

function buildWeeklyWindows(totalWeeks: number): WeeklyAggregate[] {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const oldestWeekStart = new Date(currentWeekStart);
  oldestWeekStart.setDate(oldestWeekStart.getDate() - 7 * (totalWeeks - 1));

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekStart = new Date(oldestWeekStart);
    weekStart.setDate(weekStart.getDate() + index * 7);

    return {
      key: weekStart.toISOString().slice(0, 10),
      week: formatWeekLabel(weekStart),
      volume: 0,
      effectiveSets: 0,
      totalSets: 0,
      sessions: 0,
      e1rms: [],
    };
  });
}

export default async function ProgressPage() {
  const [sessions, latestRecovery, bodyMetrics, photos] = await Promise.all([
    prisma.session.findMany({
      where: { userId: DEFAULT_USER_ID, status: "completed" },
      orderBy: { date: "asc" },
      include: {
        workoutSets: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                primaryMuscle: true,
              },
            },
          },
        },
      },
    }),
    prisma.recoverySnapshot.findFirst({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { date: "desc" },
      select: {
        source: true,
        sleepHours: true,
        hrvMs: true,
        restingHrBpm: true,
        subjectiveEnergy: true,
        stressLevel: true,
      },
    }),
    prisma.bodyMetric.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { date: "desc" },
      take: 90,
    }),
    prisma.progressPhoto.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { date: "desc" },
      take: 3,
    }),
  ]);

  const weeklyWindows = buildWeeklyWindows(8);
  const weeklyMap = new Map<string, WeeklyAggregate>(
    weeklyWindows.map((item) => [item.key, item])
  );
  const currentWeekKey = weeklyWindows[weeklyWindows.length - 1].key;

  const muscleSetsMap = new Map<string, number>();
  const exerciseBestMap = new Map<string, ExerciseBest>();
  const exerciseTrackerMap = new Map<
    string,
    { weight: number; reps: number; e1rm: number; volume: number; name: string }
  >();
  const prs: ProgressPrItem[] = [];

  for (const session of sessions) {
    const weekKey = getWeekStart(session.date).toISOString().slice(0, 10);
    const weekData = weeklyMap.get(weekKey);
    const groupedSessionSets = new Map<
      string,
      { name: string; sets: { weight: number; reps: number; rir: number | null }[] }
    >();

    for (const set of session.workoutSets) {
      if (weekData) {
        weekData.totalSets += 1;
        weekData.volume += set.weight * set.reps;
        if (set.rir !== null && set.rir <= 3) weekData.effectiveSets += 1;
      }

      if (weekKey === currentWeekKey && set.rir !== null && set.rir <= 3) {
        const currentSets = muscleSetsMap.get(set.exercise.primaryMuscle) ?? 0;
        muscleSetsMap.set(set.exercise.primaryMuscle, currentSets + 1);
      }

      if (!groupedSessionSets.has(set.exerciseId)) {
        groupedSessionSets.set(set.exerciseId, {
          name: set.exercise.name,
          sets: [],
        });
      }

      groupedSessionSets.get(set.exerciseId)?.sets.push({
        weight: set.weight,
        reps: set.reps,
        rir: set.rir,
      });
    }

    if (weekData) weekData.sessions += 1;

    for (const [exerciseId, groupedExercise] of groupedSessionSets) {
      const maxWeight = Math.max(...groupedExercise.sets.map((set) => set.weight));
      const maxReps = Math.max(...groupedExercise.sets.map((set) => set.reps));
      const maxE1rm = Math.max(
        ...groupedExercise.sets.map((set) => calculateE1RM(set.weight, set.reps))
      );
      const totalVolume = calculateVolume(groupedExercise.sets);

      if (weekData) weekData.e1rms.push(maxE1rm);

      const tracker = exerciseTrackerMap.get(exerciseId) ?? {
        weight: 0,
        reps: 0,
        e1rm: 0,
        volume: 0,
        name: groupedExercise.name,
      };

      if (maxWeight > tracker.weight)
        prs.push({
          date: session.date,
          exerciseName: groupedExercise.name,
          type: "weight",
          value: maxWeight,
        });
      if (maxReps > tracker.reps)
        prs.push({
          date: session.date,
          exerciseName: groupedExercise.name,
          type: "reps",
          value: maxReps,
        });
      if (maxE1rm > tracker.e1rm)
        prs.push({
          date: session.date,
          exerciseName: groupedExercise.name,
          type: "e1rm",
          value: Math.round(maxE1rm * 10) / 10,
        });
      if (totalVolume > tracker.volume)
        prs.push({
          date: session.date,
          exerciseName: groupedExercise.name,
          type: "volume",
          value: Math.round(totalVolume),
        });

      const nextTracker = {
        weight: Math.max(tracker.weight, maxWeight),
        reps: Math.max(tracker.reps, maxReps),
        e1rm: Math.max(tracker.e1rm, maxE1rm),
        volume: Math.max(tracker.volume, totalVolume),
        name: tracker.name,
      };
      exerciseTrackerMap.set(exerciseId, nextTracker);

      exerciseBestMap.set(exerciseId, {
        exerciseId,
        exerciseName: groupedExercise.name,
        bestE1rm: Math.round(nextTracker.e1rm * 10) / 10,
      });
    }
  }

  const weeklyVolumeData = [...weeklyMap.values()];
  const weeklySessions = weeklyVolumeData.map((item) => item.sessions);
  const weeklyEffectiveSets = weeklyVolumeData.map((item) => item.effectiveSets);
  const e1rmTrends = weeklyVolumeData.map((item, index, array) => {
    const previous = index > 0 ? array[index - 1].e1rms : [];
    const base = item.e1rms.length > 0 ? item.e1rms : previous;
    const avg = base.length > 0 ? base.reduce((sum, value) => sum + value, 0) / base.length : 0;
    return { week: index, avgE1rm: avg };
  });

  const score = calculateScore({
    weeklySessions,
    weeklyEffectiveSets,
    targetSetsPerWeek: 40,
    targetSessionsPerWeek: 4,
    e1rmTrends,
    latestRecovery: latestRecovery
        ? {
            sleepHours: latestRecovery.sleepHours,
            hrvMs: latestRecovery.hrvMs,
            restingHrBpm: latestRecovery.restingHrBpm,
            subjectiveEnergy: latestRecovery.subjectiveEnergy,
            stressLevel: latestRecovery.stressLevel,
          }
        : null,
  });

  const scoreTrendData = weeklyVolumeData.map((item, index) => {
    const partialScore = calculateScore({
      weeklySessions: weeklySessions.slice(0, index + 1),
      weeklyEffectiveSets: weeklyEffectiveSets.slice(0, index + 1),
      targetSetsPerWeek: 40,
      targetSessionsPerWeek: 4,
      e1rmTrends: e1rmTrends.slice(0, index + 1),
      latestRecovery: latestRecovery
        ? {
            sleepHours: latestRecovery.sleepHours,
            hrvMs: latestRecovery.hrvMs,
            restingHrBpm: latestRecovery.restingHrBpm,
            subjectiveEnergy: latestRecovery.subjectiveEnergy,
            stressLevel: latestRecovery.stressLevel,
          }
        : null,
    });
    return { week: item.week, score: partialScore.total };
  });

  const volumeByMuscleData = [...muscleSetsMap.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      label: MUSCLE_LABELS[muscle] ?? muscle,
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 10);

  const recentPrs = [...prs]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);

  const topExercises = [...exerciseBestMap.values()]
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 5);

  const totalSessions8Weeks = weeklyVolumeData.reduce((sum, week) => sum + week.sessions, 0);
  const averageSessionsPerWeek = totalSessions8Weeks / 8;
  const currentWeek = weeklyVolumeData[weeklyVolumeData.length - 1];
  const currentEffectiveRatio =
    currentWeek.totalSets > 0 ? (currentWeek.effectiveSets / currentWeek.totalSets) * 100 : 0;

  const weightEntries = [...bodyMetrics]
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
  const currentWeight =
    weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weightKg : null;
  const recomposition = detectRecomposition(
    weightEntries.map((entry) => ({ date: entry.date, weightKg: entry.weightKg })),
    e1rmTrends
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Progreso</h1>

      <Tabs defaultValue="score">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="score">Score</TabsTrigger>
          <TabsTrigger value="volume">Volumen</TabsTrigger>
          <TabsTrigger value="prs">PRs</TabsTrigger>
          <TabsTrigger value="body">Cuerpo</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="space-y-4">
          <ScoreCard score={score} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tendencia del score (8 semanas)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreTrendChart data={scoreTrendData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Estado de recuperación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestRecovery ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border/80 px-3 py-2">
                    <p className="text-xs text-muted-foreground">HRV</p>
                    <p className="font-mono">{latestRecovery.hrvMs?.toFixed(1) ?? "—"} ms</p>
                  </div>
                  <div className="rounded-md border border-border/80 px-3 py-2">
                    <p className="text-xs text-muted-foreground">FC reposo</p>
                    <p className="font-mono">{latestRecovery.restingHrBpm ?? "—"} bpm</p>
                  </div>
                  <div className="rounded-md border border-border/80 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Sueño</p>
                    <p className="font-mono">
                      {latestRecovery.sleepHours !== null
                        ? `${latestRecovery.sleepHours.toFixed(1)} h`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/80 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Energía</p>
                    <p className="font-mono">{latestRecovery.subjectiveEnergy ?? "—"}/10</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin snapshots recientes de recuperación.
                </p>
              )}

              <div className="flex items-center justify-between">
                {latestRecovery ? (
                  <Badge variant="outline">
                    {latestRecovery.source === "manual" ? "✏️ manual" : "⌚ shortcut"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sin datos</Badge>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href="/progress/recovery">Ver detalle</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Series efectivas por músculo (semana actual)</CardTitle>
            </CardHeader>
            <CardContent>
              {volumeByMuscleData.length > 0 ? (
                <VolumeChart data={volumeByMuscleData} />
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sin datos de series efectivas esta semana.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Volumen total (últimas 8 semanas)</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyVolumeChart data={weeklyVolumeData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prs" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">PRs recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentPrs.length > 0 ? (
                recentPrs.map((pr, index) => (
                  <div
                    key={`${pr.exerciseName}-${pr.type}-${index}`}
                    className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{pr.exerciseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrType(pr.type)} ·{" "}
                        {pr.date.toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <Badge>🏆 {pr.value}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Sin PRs detectados todavía.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 ejercicios por e1RM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topExercises.map((exercise) => (
                <Link key={exercise.exerciseId} href={`/train/exercises/${exercise.exerciseId}`}>
                  <div className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2 hover:bg-accent/40 transition-colors">
                    <p className="text-sm font-medium">{exercise.exerciseName}</p>
                    <p className="font-mono text-sm text-primary">{exercise.bestE1rm} kg</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="body" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Composición corporal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-3xl font-bold text-primary">
                    {currentWeight !== null ? currentWeight.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Peso actual (kg)</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/progress/body">Ver detalle</Link>
                </Button>
              </div>
              {weightChartData.length > 0 ? <WeightChart data={weightChartData.slice(-30)} /> : null}
              {recomposition.isRecomposition ? (
                <Badge className="bg-green-500 hover:bg-green-500 text-white">
                  Recomp detectada
                </Badge>
              ) : (
                <Badge variant="outline">{recomposition.message}</Badge>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Últimas fotos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-md border border-border/80">
                      <Image
                        src={photo.imageUrl}
                        alt={`Foto de progreso ${photo.angle}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún no has subido fotos de progreso.</p>
              )}

              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/progress/photos">Ver galería</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/progress/photos/add">Añadir foto</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="font-mono text-2xl font-semibold">
                  {averageSessionsPerWeek.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">Sesiones/semana</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="font-mono text-2xl font-semibold">
                  {Math.round(currentWeek.volume).toLocaleString("es-ES")}
                </p>
                <p className="text-[10px] text-muted-foreground">Volumen actual (kg)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="font-mono text-2xl font-semibold text-primary">
                  {Math.round(currentEffectiveRatio)}%
                </p>
                <p className="text-[10px] text-muted-foreground">Ratio efectivas</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumen semanal (8 semanas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weeklyVolumeData.map((week) => {
                const effectiveRatio =
                  week.totalSets > 0
                    ? Math.round((week.effectiveSets / week.totalSets) * 100)
                    : 0;
                return (
                  <div
                    key={week.week}
                    className="grid grid-cols-4 gap-2 rounded-md border border-border/80 px-3 py-2 text-center"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Semana</p>
                      <p className="font-mono text-sm">{week.week}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sesiones</p>
                      <p className="font-mono text-sm">{week.sessions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vol (kg)</p>
                      <p className="font-mono text-sm">
                        {Math.round(week.volume).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Efectivas</p>
                      <p className="font-mono text-sm text-primary">{effectiveRatio}%</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
