import { NextRequest, NextResponse } from "next/server";
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
