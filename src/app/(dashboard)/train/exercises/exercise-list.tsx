"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Exercise {
    id: string;
    name: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    pattern: string;
    equipment: string;
    difficulty: string;
    minRepRange: number;
    maxRepRange: number;
    recommendedRIR: number;
    cues: string[];
    commonMistakes: string[];
    notes: string | null;
    isFavorite: boolean;
    isAvoided: boolean;
    avoidReason: string | null;
}

interface ExerciseListProps {
    exercises: Exercise[];
    muscles: string[];
    patterns: string[];
    equipments: string[];
}

const PATTERN_LABELS: Record<string, string> = {
    push: "Empuje",
    pull: "Tirón",
    squat: "Sentadilla",
    hinge: "Bisagra",
    carry: "Cargado",
    isolation: "Aislamiento",
};

const EQUIPMENT_LABELS: Record<string, string> = {
    barbell: "Barra",
    dumbbell: "Mancuerna",
    cable: "Polea",
    machine: "Máquina",
    bodyweight: "Cuerpo",
};

const MUSCLE_LABELS: Record<string, string> = {
    chest: "Pecho",
    back: "Espalda",
    shoulders: "Hombros",
    quads: "Cuádriceps",
    hamstrings: "Isquiotibiales",
    glutes: "Glúteos",
    biceps: "Bíceps",
    triceps: "Tríceps",
    calves: "Gemelos",
    abs: "Abdominales",
    forearms: "Antebrazos",
    traps: "Trapecios",
    lateral_delts: "Deltoides lateral",
    rear_delts: "Deltoides posterior",
};

export function ExerciseList({
    exercises,
    muscles,
    patterns,
    equipments,
}: ExerciseListProps) {
    const [search, setSearch] = useState("");
    const [muscleFilter, setMuscleFilter] = useState("all");
    const [patternFilter, setPatternFilter] = useState("all");
    const [equipmentFilter, setEquipmentFilter] = useState("all");

    const filtered = exercises.filter((ex) => {
        if (search && !ex.name.toLowerCase().includes(search.toLowerCase()))
            return false;
        if (muscleFilter !== "all" && ex.primaryMuscle !== muscleFilter)
            return false;
        if (patternFilter !== "all" && ex.pattern !== patternFilter) return false;
        if (equipmentFilter !== "all" && ex.equipment !== equipmentFilter)
            return false;
        return true;
    });

    return (
        <div className="space-y-4">
            {/* Search */}
            <Input
                placeholder="Buscar ejercicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11"
            />

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                <Select value={muscleFilter} onValueChange={setMuscleFilter}>
                    <SelectTrigger className="w-[130px] shrink-0 h-9">
                        <SelectValue placeholder="Músculo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {muscles.map((m) => (
                            <SelectItem key={m} value={m}>
                                {MUSCLE_LABELS[m] || m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={patternFilter} onValueChange={setPatternFilter}>
                    <SelectTrigger className="w-[130px] shrink-0 h-9">
                        <SelectValue placeholder="Patrón" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {patterns.map((p) => (
                            <SelectItem key={p} value={p}>
                                {PATTERN_LABELS[p] || p}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                    <SelectTrigger className="w-[130px] shrink-0 h-9">
                        <SelectValue placeholder="Equipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {equipments.map((eq) => (
                            <SelectItem key={eq} value={eq}>
                                {EQUIPMENT_LABELS[eq] || eq}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Results */}
            <p className="text-xs text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 && "s"}
            </p>

            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            <p className="text-lg mb-1">📚</p>
                            <p className="text-sm">No hay ejercicios todavía.</p>
                            <p className="text-xs mt-1">
                                Ejecuta el seed para cargar la biblioteca base.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    filtered.map((exercise) => (
                        <Link key={exercise.id} href={`/train/exercises/${exercise.id}`}>
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {exercise.isFavorite && "⭐ "}
                                                {exercise.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <Badge variant="secondary" className="text-[10px] h-5">
                                                    {MUSCLE_LABELS[exercise.primaryMuscle] ||
                                                        exercise.primaryMuscle}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] h-5">
                                                    {EQUIPMENT_LABELS[exercise.equipment] ||
                                                        exercise.equipment}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] h-5">
                                                    {PATTERN_LABELS[exercise.pattern] || exercise.pattern}
                                                </Badge>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                                            {exercise.minRepRange}-{exercise.maxRepRange} reps
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
