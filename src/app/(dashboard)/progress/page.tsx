import Link from "next/link";
import { VolumeChart } from "@/components/charts/volume-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateE1RM, calculateVolume } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

interface WeeklyAggregate {
  week: string;
  volume: number;
  effectiveSets: number;
  totalSets: number;
  sessions: number;
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

export default async function ProgressPage() {
  const sessions = await prisma.session.findMany({
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
  });

  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const oldestWeekStart = new Date(currentWeekStart);
  oldestWeekStart.setDate(oldestWeekStart.getDate() - 7 * 7);

  const weekStarts = Array.from({ length: 8 }, (_, index) => {
    const weekStart = new Date(oldestWeekStart);
    weekStart.setDate(weekStart.getDate() + index * 7);
    return weekStart;
  });

  const weeklyMap = new Map<string, WeeklyAggregate>();
  for (const weekStart of weekStarts) {
    const key = weekStart.toISOString().slice(0, 10);
    weeklyMap.set(key, {
      week: formatWeekLabel(weekStart),
      volume: 0,
      effectiveSets: 0,
      totalSets: 0,
      sessions: 0,
    });
  }

  const muscleSetsMap = new Map<string, number>();
  const exerciseBestMap = new Map<string, ExerciseBest>();
  const exerciseTrackerMap = new Map<
    string,
    { weight: number; reps: number; e1rm: number; volume: number; name: string }
  >();
  const prs: ProgressPrItem[] = [];

  for (const session of sessions) {
    const weekKey = getWeekStart(session.date).toISOString().slice(0, 10);
    const isWithinLast8Weeks = weeklyMap.has(weekKey);
    const isCurrentWeek = session.date >= currentWeekStart;

    const groupedSessionSets = new Map<
      string,
      { name: string; sets: { weight: number; reps: number; rir: number | null }[] }
    >();

    for (const set of session.workoutSets) {
      if (isWithinLast8Weeks) {
        const weekData = weeklyMap.get(weekKey);
        if (weekData) {
          weekData.totalSets += 1;
          weekData.volume += set.weight * set.reps;
          if (set.rir !== null && set.rir <= 3) weekData.effectiveSets += 1;
        }
      }

      if (isCurrentWeek && set.rir !== null && set.rir <= 3) {
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

    if (isWithinLast8Weeks) {
      const weekData = weeklyMap.get(weekKey);
      if (weekData) weekData.sessions += 1;
    }

    for (const [exerciseId, groupedExercise] of groupedSessionSets) {
      const maxWeight = Math.max(...groupedExercise.sets.map((set) => set.weight));
      const maxReps = Math.max(...groupedExercise.sets.map((set) => set.reps));
      const maxE1rm = Math.max(
        ...groupedExercise.sets.map((set) => calculateE1RM(set.weight, set.reps))
      );
      const totalVolume = calculateVolume(groupedExercise.sets);

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

  const volumeByMuscleData = [...muscleSetsMap.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      label: MUSCLE_LABELS[muscle] ?? muscle,
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 10);

  const weeklyVolumeData = [...weeklyMap.values()];
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Progreso</h1>

      <Tabs defaultValue="volume">
        <TabsList className="w-full">
          <TabsTrigger value="volume">Volumen</TabsTrigger>
          <TabsTrigger value="prs">PRs</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

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
