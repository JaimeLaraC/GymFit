import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateVolume,
  countEffectiveSets,
  detectPRs,
  type PR,
} from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

interface GroupedExerciseSets {
  exerciseId: string;
  exerciseName: string;
  sets: {
    id: string;
    setNumber: number;
    reps: number;
    weight: number;
    rir: number | null;
  }[];
}

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

function formatPrLabel(prType: PR["type"]): string {
  if (prType === "weight") return "Peso";
  if (prType === "reps") return "Repeticiones";
  if (prType === "e1rm") return "e1RM";
  return "Volumen";
}

export default async function SessionDetailPage({ params }: HistoryDetailPageProps) {
  const { id } = await params;

  const session = await prisma.session.findFirst({
    where: { id, userId: DEFAULT_USER_ID },
    include: {
      workoutSets: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
        include: {
          exercise: {
            select: { id: true, name: true },
          },
        },
      },
      routine: {
        select: { name: true },
      },
    },
  });

  if (!session) notFound();

  const exerciseOrder: string[] = [];
  const groupedByExercise = new Map<string, GroupedExerciseSets>();

  for (const set of session.workoutSets) {
    if (!groupedByExercise.has(set.exerciseId)) {
      exerciseOrder.push(set.exerciseId);
      groupedByExercise.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        exerciseName: set.exercise.name,
        sets: [],
      });
    }

    groupedByExercise.get(set.exerciseId)?.sets.push({
      id: set.id,
      setNumber: set.setNumber,
      reps: set.reps,
      weight: set.weight,
      rir: set.rir,
    });
  }

  const groupedExercises = exerciseOrder
    .map((exerciseId) => groupedByExercise.get(exerciseId))
    .filter((entry): entry is GroupedExerciseSets => Boolean(entry));

  const totalVolume = calculateVolume(session.workoutSets);
  const effectiveSets = countEffectiveSets(session.workoutSets);

  const previousSessionIds = await prisma.session.findMany({
    where: {
      userId: session.userId,
      status: "completed",
      date: { lt: session.date },
    },
    select: { id: true },
  });

  const previousIds = previousSessionIds.map((item) => item.id);
  const exerciseIds = groupedExercises.map((item) => item.exerciseId);

  const historicalSets =
    previousIds.length === 0 || exerciseIds.length === 0
      ? []
      : await prisma.workoutSet.findMany({
          where: {
            exerciseId: { in: exerciseIds },
            sessionId: { in: previousIds },
          },
          select: {
            exerciseId: true,
            weight: true,
            reps: true,
          },
        });

  const historicalByExercise = new Map<string, { weight: number; reps: number }[]>();
  for (const historicalSet of historicalSets) {
    if (!historicalByExercise.has(historicalSet.exerciseId))
      historicalByExercise.set(historicalSet.exerciseId, []);

    historicalByExercise.get(historicalSet.exerciseId)?.push({
      weight: historicalSet.weight,
      reps: historicalSet.reps,
    });
  }

  const prs: PR[] = groupedExercises.flatMap((exercise) =>
    detectPRs(
      exercise.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        rir: set.rir,
      })),
      historicalByExercise.get(exercise.exerciseId) ?? [],
      exercise.exerciseName,
      session.date
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Detalle de sesión</h1>
        <Badge variant="outline">
          {session.date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{session.routine?.name ?? "Sesión libre"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold">{session.workoutSets.length}</p>
              <p className="text-[10px] text-muted-foreground">Series</p>
            </div>
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold text-primary">{effectiveSets}</p>
              <p className="text-[10px] text-muted-foreground">Efectivas</p>
            </div>
            <div className="rounded-md border border-border/80 py-2">
              <p className="font-mono text-base font-semibold">
                {Math.round(totalVolume).toLocaleString("es-ES")}
              </p>
              <p className="text-[10px] text-muted-foreground">Vol (kg)</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Duración: {session.durationMin !== null ? `${session.durationMin} min` : "—"} · RPE:{" "}
            {session.overallRPE !== null ? session.overallRPE : "—"}
          </p>
        </CardContent>
      </Card>

      {prs.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🏆 PRs de la sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prs.map((pr, index) => (
              <div
                key={`${pr.exerciseName}-${pr.type}-${index}`}
                className="flex items-center justify-between rounded-md border border-primary/30 bg-background px-3 py-2"
              >
                <p className="text-sm">
                  <span className="font-medium">{pr.exerciseName}</span> ·{" "}
                  <span className="text-muted-foreground">{formatPrLabel(pr.type)}</span>
                </p>
                <Badge>+{Math.round((pr.value - pr.previousBest) * 10) / 10}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {groupedExercises.map((exercise) => (
          <Card key={exercise.exerciseId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                <Link
                  href={`/train/exercises/${exercise.exerciseId}`}
                  className="hover:text-primary transition-colors"
                >
                  {exercise.exerciseName}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exercise.sets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2"
                >
                  <p className="text-sm text-muted-foreground">Serie {set.setNumber}</p>
                  <p className="font-mono text-sm">
                    {set.weight} × {set.reps}{" "}
                    <span className="text-muted-foreground">@RIR {set.rir ?? "—"}</span>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
