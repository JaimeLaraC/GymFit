import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

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

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Score Global</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-mono text-primary">—</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            El score se activará cuando completemos la fase de cálculo global.
          </p>
        </CardContent>
      </Card>

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
