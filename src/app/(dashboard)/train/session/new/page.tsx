import { prisma } from "@/lib/prisma";
import { WorkoutSession } from "../workout-session";

export const dynamic = "force-dynamic";
export default async function NewSessionPage() {
    const exercises = await prisma.exercise.findMany({
        orderBy: [{ primaryMuscle: "asc" }, { name: "asc" }],
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

    return <WorkoutSession exercises={exercises} />;
}
