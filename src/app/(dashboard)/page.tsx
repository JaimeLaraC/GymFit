import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCard } from "@/components/score-card";
import { calculateE1RM } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { calculateScore } from "@/lib/score";

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
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
        }
      : null,
  });

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
