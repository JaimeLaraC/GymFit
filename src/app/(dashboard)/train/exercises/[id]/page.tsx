import Link from "next/link";
import { notFound } from "next/navigation";
import { E1RMChart } from "@/components/charts/e1rm-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateE1RM } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

interface ExerciseDetailPageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({
  params,
}: ExerciseDetailPageProps) {
  const { id } = await params;

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      primaryMuscle: true,
      equipment: true,
      minRepRange: true,
      maxRepRange: true,
      recommendedRIR: true,
    },
  });

  if (!exercise) notFound();

  const sessions = await prisma.session.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      status: "completed",
      workoutSets: { some: { exerciseId: id } },
    },
    orderBy: { date: "desc" },
    include: {
      workoutSets: {
        where: { exerciseId: id },
        orderBy: { setNumber: "asc" },
        select: {
          id: true,
          setNumber: true,
          weight: true,
          reps: true,
          rir: true,
          completedAt: true,
        },
      },
    },
  });

  const progressionData = [...sessions]
    .reverse()
    .map((session) => {
      const maxE1rm = Math.max(
        ...session.workoutSets.map((set) => calculateE1RM(set.weight, set.reps))
      );

      return {
        date: session.date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
        }),
        e1rm: Math.round(maxE1rm * 10) / 10,
      };
    });

  const allSets = sessions.flatMap((session) => session.workoutSets);
  const maxWeight = allSets.length > 0 ? Math.max(...allSets.map((set) => set.weight)) : 0;
  const maxReps = allSets.length > 0 ? Math.max(...allSets.map((set) => set.reps)) : 0;
  const maxE1rm =
    allSets.length > 0
      ? Math.max(...allSets.map((set) => calculateE1RM(set.weight, set.reps)))
      : 0;
  const currentE1rm =
    progressionData.length > 0 ? progressionData[progressionData.length - 1].e1rm : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{exercise.name}</h1>
        <Badge variant="outline">{exercise.primaryMuscle}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold">{maxWeight.toFixed(1)} kg</p>
              <p className="text-[10px] text-muted-foreground">PR Peso</p>
            </div>
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold">{maxReps}</p>
              <p className="text-[10px] text-muted-foreground">PR Reps</p>
            </div>
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold text-primary">
                {maxE1rm.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">PR e1RM</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            e1RM actual: <span className="font-mono">{currentE1rm.toFixed(1)} kg</span> ·
            Rango objetivo:{" "}
            <span className="font-mono">
              {exercise.minRepRange}-{exercise.maxRepRange}
            </span>{" "}
            reps @RIR {exercise.recommendedRIR}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Progresión de e1RM</CardTitle>
        </CardHeader>
        <CardContent>
          {progressionData.length > 0 ? (
            <E1RMChart data={progressionData} exerciseName={exercise.name} />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aún no hay datos para este ejercicio.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimas 5 sesiones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.slice(0, 5).map((session) => (
            <div
              key={session.id}
              className="rounded-md border border-border/80 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {session.date.toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <Link
                  href={`/train/history/${session.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Ver sesión
                </Link>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground font-mono">
                {session.workoutSets.map((set) => (
                  <span key={set.id}>
                    {set.weight}×{set.reps}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Sin sesiones registradas para este ejercicio.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
