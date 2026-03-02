import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSession, ProgressionInput } from "@/lib/progression";
import { prisma } from "@/lib/prisma";

const AnalyzePayloadSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId es requerido"),
});

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export async function POST(request: NextRequest) {
  const parsedBody = AnalyzePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success)
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Payload inválido" },
      { status: 400 }
    );

  const session = await prisma.session.findUnique({
    where: { id: parsedBody.data.sessionId },
    include: {
      workoutSets: {
        include: {
          exercise: true,
        },
        orderBy: {
          setNumber: "asc",
        },
      },
      routine: true,
    },
  });

  if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const [routineExercises, historicalSessions, latestRecovery, weeklySessions] = await Promise.all([
    session.routineId
      ? prisma.routineExercise.findMany({
          where: { routineId: session.routineId },
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
        userId: session.userId,
        status: "completed",
        date: { lte: session.date },
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
    prisma.recoverySnapshot.findFirst({
      where: {
        userId: session.userId,
        date: { lte: session.date },
      },
      orderBy: { date: "desc" },
      select: {
        sleepHours: true,
        hrvMs: true,
        restingHrBpm: true,
        subjectiveEnergy: true,
      },
    }),
    prisma.session.findMany({
      where: {
        userId: session.userId,
        status: "completed",
        date: {
          gte: getWeekStart(session.date),
          lte: session.date,
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

  for (const set of session.workoutSets) {
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
      const config = routineExerciseMap.get(exerciseId);
      const historicalByExercise = historicalSessions
        .filter((historicalSession) =>
          historicalSession.workoutSets.some((set) => set.exerciseId === exerciseId)
        )
        .slice(0, 6)
        .map((historicalSession) => ({
          date: historicalSession.date,
          sets: historicalSession.workoutSets
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
          config?.method === "double_progression" ||
          config?.method === "top_set_backoff" ||
          config?.method === "rest_pause"
            ? config.method
            : "standard",
        targetMinReps: config?.targetMinReps ?? 6,
        targetMaxReps: config?.targetMaxReps ?? 12,
        targetRIR: config?.targetRIR ?? 2,
        lastSets: entry.lastSets,
        historicalSessions: historicalByExercise,
      };
    }
  );

  const weeklySets = weeklySessions.flatMap((weeklySession) => weeklySession.workoutSets);

  const analysis = analyzeSession({
    exercises: progressionInputs,
    weeklySets,
    latestRecovery,
  });

  return NextResponse.json(analysis);
}
