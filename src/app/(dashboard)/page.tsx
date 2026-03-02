import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCard } from "@/components/score-card";
import { calculateE1RM } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { analyzeSession, ProgressionInput } from "@/lib/progression";
import { calculateScore } from "@/lib/score";

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function formatPrimarySuggestion(
  analysis: ReturnType<typeof analyzeSession>
): { title: string; description: string } | null {
  const progression =
    analysis.progressions.find((item) => item.type === "increase_weight") ??
    analysis.progressions.find((item) => item.type === "decrease_weight") ??
    analysis.progressions.find((item) => item.type === "deload") ??
    null;

  if (progression) {
    const actionLabel =
      progression.type === "increase_weight"
        ? "sube"
        : progression.type === "decrease_weight"
          ? "baja"
          : progression.type === "deload"
            ? "deload"
            : "ajusta";
    const weightLabel = progression.newWeight !== null ? ` a ${progression.newWeight} kg` : "";

    return {
      title: `🏋️ ${progression.exerciseName} → ${actionLabel}${weightLabel}`,
      description: progression.reason,
    };
  }

  const stagnation = analysis.stagnations.find((item) => item.isStagnated);
  if (stagnation) {
    return {
      title: `⚠️ ${stagnation.exerciseName} estancado (${stagnation.weeksSinceProgress} semanas)`,
      description: stagnation.suggestion,
    };
  }

  if (analysis.junkVolume.hasJunkVolume) {
    return {
      title: `⚠️ Junk volume ${analysis.junkVolume.percentage}%`,
      description: analysis.junkVolume.suggestion,
    };
  }

  return null;
}

export default async function HomePage() {
  const thisWeekStart = getWeekStart(new Date());
  const fourWeeksAgo = new Date(thisWeekStart);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 21);

  const weeklySessions = await prisma.session.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      date: { gte: thisWeekStart },
      status: "completed",
    },
    include: {
      workoutSets: {
        select: {
          weight: true,
          reps: true,
          rir: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const weeklyStats = {
    sessions: weeklySessions.length,
    totalSets: weeklySessions.reduce((sum, session) => sum + session.workoutSets.length, 0),
    totalVolume: weeklySessions.reduce(
      (volume, session) =>
        volume +
        session.workoutSets.reduce((sessionVolume, set) => sessionVolume + set.weight * set.reps, 0),
      0
    ),
    effectiveSets: weeklySessions.reduce(
      (sum, session) =>
        sum + session.workoutSets.filter((set) => set.rir !== null && set.rir <= 3).length,
      0
    ),
  };

  const scoreSessions = await prisma.session.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      status: "completed",
      date: { gte: fourWeeksAgo },
    },
    include: {
      workoutSets: {
        select: {
          weight: true,
          reps: true,
          rir: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const latestRecovery = await prisma.recoverySnapshot.findFirst({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { date: "desc" },
    select: {
      sleepHours: true,
      hrvMs: true,
      restingHrBpm: true,
      subjectiveEnergy: true,
      stressLevel: true,
    },
  });

  const latestSession = await prisma.session.findFirst({
    where: {
      userId: DEFAULT_USER_ID,
      status: "completed",
    },
    orderBy: { date: "desc" },
    include: {
      workoutSets: {
        include: {
          exercise: true,
        },
        orderBy: {
          setNumber: "asc",
        },
      },
    },
  });

  const weeklyMap = new Map<
    string,
    {
      sessions: number;
      effectiveSets: number;
      e1rms: number[];
    }
  >(
    Array.from({ length: 4 }, (_, index) => {
      const weekDate = new Date(fourWeeksAgo);
      weekDate.setDate(weekDate.getDate() + index * 7);
      const weekKey = getWeekStart(weekDate).toISOString().slice(0, 10);
      return [
        weekKey,
        {
          sessions: 0,
          effectiveSets: 0,
          e1rms: [] as number[],
        },
      ];
    })
  );

  for (const session of scoreSessions) {
    const weekKey = getWeekStart(session.date).toISOString().slice(0, 10);
    const weekData = weeklyMap.get(weekKey);
    if (!weekData) continue;

    weekData.sessions += 1;
    for (const set of session.workoutSets) {
      if (set.rir !== null && set.rir <= 3) weekData.effectiveSets += 1;
      weekData.e1rms.push(calculateE1RM(set.weight, set.reps));
    }
  }

  const weeklyScoreData = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value], weekIndex) => {
      const avgE1rm =
        value.e1rms.length > 0
          ? value.e1rms.reduce((sum, item) => sum + item, 0) / value.e1rms.length
          : 0;
      return {
        week: weekIndex,
        sessions: value.sessions,
        effectiveSets: value.effectiveSets,
        avgE1rm,
      };
    });

  const score = calculateScore({
    weeklySessions: weeklyScoreData.map((item) => item.sessions),
    weeklyEffectiveSets: weeklyScoreData.map((item) => item.effectiveSets),
    targetSetsPerWeek: 40,
    targetSessionsPerWeek: 4,
    e1rmTrends: weeklyScoreData.map((item) => ({ week: item.week, avgE1rm: item.avgE1rm })),
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

  let primarySuggestion: { title: string; description: string } | null = null;

  if (latestSession && latestSession.workoutSets.length > 0) {
    const [routineExercises, historicalSessions, weeklySessionsForLatest] = await Promise.all([
      latestSession.routineId
        ? prisma.routineExercise.findMany({
            where: { routineId: latestSession.routineId },
            select: {
              exerciseId: true,
              targetMinReps: true,
              targetMaxReps: true,
              targetRIR: true,
              method: true,
            },
          })
        : Promise.resolve([]),
      prisma.session.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          status: "completed",
          date: { lte: latestSession.date },
        },
        orderBy: { date: "desc" },
        take: 40,
        include: {
          workoutSets: {
            include: {
              exercise: true,
            },
          },
        },
      }),
      prisma.session.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          status: "completed",
          date: {
            gte: getWeekStart(latestSession.date),
            lte: latestSession.date,
          },
        },
        include: {
          workoutSets: {
            select: {
              rir: true,
            },
          },
        },
      }),
    ]);

    const routineExerciseMap = new Map(routineExercises.map((item) => [item.exerciseId, item]));
    const currentSessionByExercise = new Map<
      string,
      {
        exerciseName: string;
        lastSets: {
          weight: number;
          reps: number;
          rir: number | null;
        }[];
      }
    >();

    for (const set of latestSession.workoutSets) {
      if (!currentSessionByExercise.has(set.exerciseId)) {
        currentSessionByExercise.set(set.exerciseId, {
          exerciseName: set.exercise.name,
          lastSets: [],
        });
      }
      currentSessionByExercise.get(set.exerciseId)?.lastSets.push({
        weight: set.weight,
        reps: set.reps,
        rir: set.rir,
      });
    }

    const progressionInputs: ProgressionInput[] = [...currentSessionByExercise.entries()].map(
      ([exerciseId, entry]) => {
        const routineConfig = routineExerciseMap.get(exerciseId);
        const exerciseHistory = historicalSessions
          .filter((session) => session.workoutSets.some((set) => set.exerciseId === exerciseId))
          .slice(0, 6)
          .map((session) => ({
            date: session.date,
            sets: session.workoutSets
              .filter((set) => set.exerciseId === exerciseId)
              .map((set) => ({
                weight: set.weight,
                reps: set.reps,
                rir: set.rir,
              })),
          }));

        return {
          exerciseId,
          exerciseName: entry.exerciseName,
          method:
            routineConfig?.method === "double_progression" ||
            routineConfig?.method === "top_set_backoff" ||
            routineConfig?.method === "rest_pause"
              ? routineConfig.method
              : "standard",
          targetMinReps: routineConfig?.targetMinReps ?? 6,
          targetMaxReps: routineConfig?.targetMaxReps ?? 12,
          targetRIR: routineConfig?.targetRIR ?? 2,
          lastSets: entry.lastSets,
          historicalSessions: exerciseHistory,
        };
      }
    );

    const analysis = analyzeSession({
      exercises: progressionInputs,
      weeklySets: weeklySessionsForLatest.flatMap((session) => session.workoutSets),
      latestRecovery: latestRecovery
        ? {
            sleepHours: latestRecovery.sleepHours,
            hrvMs: latestRecovery.hrvMs,
            restingHrBpm: latestRecovery.restingHrBpm,
            subjectiveEnergy: latestRecovery.subjectiveEnergy,
          }
        : null,
    });

    primarySuggestion = formatPrimarySuggestion(analysis);
  }

  const routines = await prisma.routine.findMany({
    where: {
      program: {
        is: {
          userId: DEFAULT_USER_ID,
          status: "active",
        },
      },
    },
    orderBy: { dayOfWeek: "asc" },
    select: {
      id: true,
      name: true,
      estimatedDurationMin: true,
      dayOfWeek: true,
    },
  });

  const today = new Date().getDay();
  const nextRoutine =
    routines.find((routine) => routine.dayOfWeek !== null && routine.dayOfWeek >= today) ??
    routines[0] ??
    null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GymFit</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </div>

      <ScoreCard score={score} />

      {primarySuggestion ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sugerencia IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">{primarySuggestion.title}</p>
            <p className="text-xs text-muted-foreground">{primarySuggestion.description}</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/ai">Ver más en IA →</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Link href="/nutrition">
        <Card className="cursor-pointer transition-colors hover:bg-accent">
          <CardContent className="pt-6 text-center">
            <span className="text-3xl">🍽️</span>
            <p className="mt-2 text-sm font-medium">Nutrición</p>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próxima sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextRoutine ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{nextRoutine.name}</span>
                {nextRoutine.estimatedDurationMin !== null
                  ? ` · ~${nextRoutine.estimatedDurationMin} min`
                  : ""}
              </p>
              <Button asChild size="sm" className="w-full">
                <Link href="/train/session/new">▶ Empezar entreno</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No tienes rutinas activas todavía.
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/train">🏋️ Entrenar</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/train/exercises">📚 Ver ejercicios</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-mono">{weeklyStats.sessions}</p>
              <p className="text-xs text-muted-foreground">Sesiones</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{weeklyStats.totalSets}</p>
              <p className="text-xs text-muted-foreground">Series</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">
                {Math.round(weeklyStats.totalVolume).toLocaleString("es-ES")}
              </p>
              <p className="text-xs text-muted-foreground">Vol. (kg)</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Series efectivas:{" "}
            <span className="font-mono text-primary">{weeklyStats.effectiveSets}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
