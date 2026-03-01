import { prisma } from "@/lib/prisma";
import { ExerciseList } from "./exercise-list";

export const dynamic = "force-dynamic";
export default async function ExercisesPage() {
    const exercises = await prisma.exercise.findMany({
        orderBy: [{ primaryMuscle: "asc" }, { name: "asc" }],
    });

    const muscles = [...new Set(exercises.map((e) => e.primaryMuscle))].sort();
    const patterns = [...new Set(exercises.map((e) => e.pattern))].sort();
    const equipments = [...new Set(exercises.map((e) => e.equipment))].sort();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Ejercicios</h1>
                <span className="text-sm text-muted-foreground">
                    {exercises.length} ejercicios
                </span>
            </div>

            <ExerciseList
                exercises={exercises}
                muscles={muscles}
                patterns={patterns}
                equipments={equipments}
            />
        </div>
    );
}
