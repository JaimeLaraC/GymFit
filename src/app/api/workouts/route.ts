import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, durationMin, sets } = body;

        if (!userId || !sets || !Array.isArray(sets)) {
            return NextResponse.json(
                { error: "userId y sets son requeridos" },
                { status: 400 }
            );
        }

        // Create session with all sets
        const session = await prisma.session.create({
            data: {
                userId,
                date: new Date(),
                durationMin: durationMin || null,
                status: "completed",
                workoutSets: {
                    create: sets.flatMap(
                        (exerciseSets: {
                            exerciseId: string;
                            sets: { weight: string; reps: string; rir: string }[];
                        }) =>
                            exerciseSets.sets.map(
                                (
                                    set: { weight: string; reps: string; rir: string },
                                    index: number
                                ) => ({
                                    exerciseId: exerciseSets.exerciseId,
                                    setNumber: index + 1,
                                    weight: parseFloat(set.weight),
                                    reps: parseInt(set.reps),
                                    rir: set.rir ? parseInt(set.rir) : null,
                                    isEffective: set.rir ? parseInt(set.rir) <= 3 : false,
                                    completedAt: new Date(),
                                })
                            )
                    ),
                },
            },
            include: {
                workoutSets: {
                    include: { exercise: true },
                },
            },
        });

        return NextResponse.json(session, { status: 201 });
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
