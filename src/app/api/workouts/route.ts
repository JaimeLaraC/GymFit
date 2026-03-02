import { NextRequest, NextResponse } from "next/server";
import { detectPRs, type PR } from "@/lib/calculations";
import { calculateStreak } from "@/lib/gamification";
import { prisma } from "@/lib/prisma";

interface WorkoutSetPayload {
  weight: string;
  reps: string;
  rir: string;
}

interface ExerciseSetsPayload {
  exerciseId: string;
  sets: WorkoutSetPayload[];
}

function formatPrTypeLabel(prType: PR["type"]): string {
  if (prType === "weight") return "peso";
  if (prType === "reps") return "reps";
  if (prType === "e1rm") return "e1RM";
  return "volumen";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, durationMin, sets } = body as {
      userId?: string;
      durationMin?: number;
      sets?: ExerciseSetsPayload[];
    };

    if (!userId || !sets || !Array.isArray(sets)) {
      return NextResponse.json(
        { error: "userId y sets son requeridos" },
        { status: 400 }
      );
    }

    const session = await prisma.session.create({
      data: {
        userId,
        date: new Date(),
        durationMin: durationMin ?? null,
        status: "completed",
        workoutSets: {
          create: sets.flatMap((exerciseSets) =>
            exerciseSets.sets.map((set, index) => ({
              exerciseId: exerciseSets.exerciseId,
              setNumber: index + 1,
              weight: Number.parseFloat(set.weight),
              reps: Number.parseInt(set.reps, 10),
              rir: set.rir ? Number.parseInt(set.rir, 10) : null,
              isEffective: set.rir ? Number.parseInt(set.rir, 10) <= 3 : false,
              completedAt: new Date(),
            }))
          ),
        },
      },
      include: {
        workoutSets: {
          include: { exercise: true },
        },
      },
    });

    const exerciseIds = [...new Set(session.workoutSets.map((set) => set.exerciseId))];
    const historicalSets = await prisma.workoutSet.findMany({
      where: {
        exerciseId: {
          in: exerciseIds,
        },
        sessionId: {
          not: session.id,
        },
        session: {
          userId,
          status: "completed",
        },
      },
      select: {
        exerciseId: true,
        weight: true,
        reps: true,
      },
    });

    const historicalSetsByExercise = new Map<string, { weight: number; reps: number }[]>();
    for (const historicalSet of historicalSets) {
      if (!historicalSetsByExercise.has(historicalSet.exerciseId))
        historicalSetsByExercise.set(historicalSet.exerciseId, []);

      historicalSetsByExercise.get(historicalSet.exerciseId)?.push({
        weight: historicalSet.weight,
        reps: historicalSet.reps,
      });
    }

    const currentSetsByExercise = new Map<
      string,
      {
        exerciseName: string;
        sets: { weight: number; reps: number; rir: number | null }[];
      }
    >();

    for (const set of session.workoutSets) {
      if (!currentSetsByExercise.has(set.exerciseId)) {
        currentSetsByExercise.set(set.exerciseId, {
          exerciseName: set.exercise.name,
          sets: [],
        });
      }

      currentSetsByExercise.get(set.exerciseId)?.sets.push({
        weight: set.weight,
        reps: set.reps,
        rir: set.rir,
      });
    }

    const prs = [...currentSetsByExercise.entries()].flatMap(([exerciseId, exerciseEntry]) =>
      detectPRs(
        exerciseEntry.sets,
        historicalSetsByExercise.get(exerciseId) ?? [],
        exerciseEntry.exerciseName,
        session.date
      )
    );

    for (const pr of prs) {
      await prisma.achievement.create({
        data: {
          userId,
          type: "pr",
          name: `PR ${pr.type}: ${pr.exerciseName}`,
          description: `Nuevo récord de ${formatPrTypeLabel(pr.type)}: ${pr.value}`,
          value: {
            ...pr,
            date: pr.date.toISOString(),
          },
        },
      });
    }

    const streak = await calculateStreak(userId);
    if (streak.isNewMilestone && streak.milestone !== null) {
      const streakName = `Racha de ${streak.milestone} días`;
      const alreadyUnlocked = await prisma.achievement.findFirst({
        where: {
          userId,
          type: "streak",
          name: streakName,
        },
        select: { id: true },
      });

      if (!alreadyUnlocked) {
        await prisma.achievement.create({
          data: {
            userId,
            type: "streak",
            name: streakName,
            description: `¡${streak.milestone} días seguidos entrenando!`,
            value: { days: streak.milestone },
          },
        });
      }
    }

    return NextResponse.json(
      {
        ...session,
        gamification: {
          prs,
          streak: {
            current: streak.currentDays,
            isNewMilestone: streak.isNewMilestone,
            milestone: streak.milestone,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating workout:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user";

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 20,
      include: {
        workoutSets: {
          include: { exercise: true },
        },
        routine: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching workouts:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
