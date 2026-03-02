"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type {
    JunkVolumeResult,
    ProgressionSuggestion,
    StagnationResult,
} from "@/lib/progression";
import type { PR } from "@/lib/calculations";

interface ExerciseForSession {
    id: string;
    name: string;
    primaryMuscle: string;
    equipment: string;
    minRepRange: number;
    maxRepRange: number;
    recommendedRIR: number;
}

interface SetLog {
    setNumber: number;
    weight: string;
    reps: string;
    rir: string;
    isEffective: boolean;
}

interface ExerciseLog {
    exercise: ExerciseForSession;
    sets: SetLog[];
}

interface SessionAnalysis {
    progressions: ProgressionSuggestion[];
    stagnations: StagnationResult[];
    junkVolume: JunkVolumeResult;
    alerts: string[];
}

interface SessionGamificationResponse {
    prs?: PR[];
    streak?: {
        current: number;
        isNewMilestone: boolean;
        milestone: number | null;
    };
    newBadges?: string[];
}

interface WorkoutSaveResponse {
    id?: string;
    session?: { id?: string };
    gamification?: SessionGamificationResponse;
}

interface SessionAchievementToast {
    id: string;
    type: "pr" | "streak" | "badge";
    title: string;
    description: string;
    icon?: string;
}

const LazyAchievementToast = dynamic(
    () => import("@/components/achievement-toast").then((mod) => mod.AchievementToast),
    { ssr: false }
);

function formatPrLabel(prType: PR["type"]): string {
    if (prType === "weight") return "Peso";
    if (prType === "reps") return "Repeticiones";
    if (prType === "e1rm") return "e1RM";
    return "Volumen";
}

export function WorkoutSession({
    exercises,
}: {
    exercises: ExerciseForSession[];
}) {
    const [sessionStarted, setSessionStarted] = useState(false);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
    const [elapsed, setElapsed] = useState(0);
    const [restTimer, setRestTimer] = useState(0);
    const [isResting, setIsResting] = useState(false);
    const [sessionFinished, setSessionFinished] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
    const [unlockedAchievements, setUnlockedAchievements] = useState<SessionAchievementToast[]>([]);

    // Session timer
    useEffect(() => {
        if (!sessionStarted || sessionFinished) return;
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, [sessionStarted, sessionFinished]);

    // Rest timer
    useEffect(() => {
        if (!isResting || restTimer <= 0) return;
        const interval = setInterval(() => {
            setRestTimer((t) => {
                if (t <= 1) {
                    setIsResting(false);
                    // Vibrate if available
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isResting, restTimer]);

    function startSession() {
        setSessionStarted(true);
        // Initialize logs for first 3 exercises if available
        const initialLogs = exercises.slice(0, exercises.length).map((ex) => ({
            exercise: ex,
            sets: [createEmptySet(1, ex)],
        }));
        setExerciseLogs(initialLogs);
    }

    function createEmptySet(num: number, exercise: ExerciseForSession): SetLog {
        return {
            setNumber: num,
            weight: "",
            reps: "",
            rir: String(exercise.recommendedRIR),
            isEffective: false,
        };
    }

    function updateSet(
        exerciseIdx: number,
        setIdx: number,
        field: keyof SetLog,
        value: string
    ) {
        setExerciseLogs((prev) => {
            const updated = [...prev];
            const sets = [...updated[exerciseIdx].sets];
            sets[setIdx] = {
                ...sets[setIdx],
                [field]: value,
                isEffective:
                    field === "rir"
                        ? parseInt(value) <= 3
                        : sets[setIdx].isEffective,
            };
            if (field === "rir") {
                sets[setIdx].isEffective = parseInt(value) <= 3;
            }
            updated[exerciseIdx] = { ...updated[exerciseIdx], sets };
            return updated;
        });
    }

    const saveSet = useCallback(
        (exerciseIdx: number, setIdx: number) => {
            const set = exerciseLogs[exerciseIdx]?.sets[setIdx];
            if (!set || !set.weight || !set.reps) return;

            // Start rest timer (120s default)
            setRestTimer(120);
            setIsResting(true);

            // Add next empty set if this is the last one
            setExerciseLogs((prev) => {
                const updated = [...prev];
                const exercise = updated[exerciseIdx];
                if (setIdx === exercise.sets.length - 1) {
                    updated[exerciseIdx] = {
                        ...exercise,
                        sets: [
                            ...exercise.sets,
                            createEmptySet(
                                exercise.sets.length + 1,
                                exercise.exercise
                            ),
                        ],
                    };
                }
                return updated;
            });
        },
        [exerciseLogs]
    );

    function skipRest() {
        setIsResting(false);
        setRestTimer(0);
    }

    async function finishSession() {
        setIsSaving(true);
        try {
            const validLogs = exerciseLogs
                .map((log) => ({
                    exerciseId: log.exercise.id,
                    sets: log.sets.filter((s) => s.weight && s.reps),
                }))
                .filter((log) => log.sets.length > 0);

            const response = await fetch("/api/workouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: "default-user",
                    durationMin: Math.round(elapsed / 60),
                    sets: validLogs,
                }),
            });

            if (response.ok) {
                const sessionResponse = (await response.json()) as WorkoutSaveResponse;
                const gamification = sessionResponse.gamification;
                const sessionId = sessionResponse.id ?? sessionResponse.session?.id;

                const newAchievementToasts: SessionAchievementToast[] = (
                    gamification?.prs ?? []
                ).map((pr, index) => ({
                    id: `pr-${pr.exerciseName}-${pr.type}-${index}`,
                    type: "pr",
                    title: `PR de ${formatPrLabel(pr.type)} en ${pr.exerciseName}`,
                    description: `${pr.previousBest} → ${pr.value}`,
                    icon: "🏆",
                }));

                const isNewStreak = gamification?.streak?.isNewMilestone;
                const streakMilestone = gamification?.streak?.milestone ?? null;
                if (isNewStreak && streakMilestone) {
                    newAchievementToasts.push({
                        id: `streak-${streakMilestone}`,
                        type: "streak",
                        title: `Racha de ${streakMilestone} días`,
                        description: `Llevas ${streakMilestone} días entrenando de forma consistente.`,
                        icon: "🔥",
                    });
                }

                const unlockedBadges = gamification?.newBadges ?? [];
                unlockedBadges.forEach((badgeText, index) => {
                    newAchievementToasts.push({
                        id: `badge-${badgeText}-${index}`,
                        type: "badge",
                        title: "Nuevo badge desbloqueado",
                        description: badgeText,
                        icon: "✨",
                    });
                });

                setUnlockedAchievements(newAchievementToasts);

                if (sessionId) {
                    try {
                        const analysisResponse = await fetch("/api/ai/analyze", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ sessionId }),
                        });

                        if (analysisResponse.ok) {
                            const nextAnalysis =
                                (await analysisResponse.json()) as SessionAnalysis;
                            setAnalysis(nextAnalysis);
                        }
                    } catch (analysisError) {
                        console.error("Error analyzing session:", analysisError);
                    }
                }

                setSessionFinished(true);
            }
        } catch (error) {
            console.error("Error saving session:", error);
        } finally {
            setIsSaving(false);
        }
    }

    function formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    // Total stats
    const totalSets = exerciseLogs.reduce(
        (sum, log) => sum + log.sets.filter((s) => s.weight && s.reps).length,
        0
    );
    const effectiveSets = exerciseLogs.reduce(
        (sum, log) =>
            sum +
            log.sets.filter(
                (s) => s.weight && s.reps && parseInt(s.rir || "99") <= 3
            ).length,
        0
    );
    const totalVolume = exerciseLogs.reduce(
        (sum, log) =>
            sum +
            log.sets
                .filter((s) => s.weight && s.reps)
                .reduce(
                    (v, s) =>
                        v + parseFloat(s.weight || "0") * parseInt(s.reps || "0"),
                    0
                ),
        0
    );

    function getProgressionBadge(suggestion: ProgressionSuggestion): string {
        if (suggestion.type === "increase_weight") return "↑ Sube";
        if (suggestion.type === "decrease_weight") return "↓ Baja";
        if (suggestion.type === "deload") return "⏸ Deload";
        if (suggestion.type === "change_exercise") return "↺ Cambia";
        return "→ Mantén";
    }

    // =================== SESSION FINISHED ===================
    if (sessionFinished) {
        return (
            <div className="space-y-6">
                {unlockedAchievements.length > 0 ? (
                    <Suspense fallback={null}>
                        <div className="fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
                            {unlockedAchievements.map((achievement) => (
                                <LazyAchievementToast
                                    key={achievement.id}
                                    type={achievement.type}
                                    title={achievement.title}
                                    description={achievement.description}
                                    icon={achievement.icon}
                                    onDismiss={() =>
                                        setUnlockedAchievements((currentAchievements) =>
                                            currentAchievements.filter(
                                                (item) => item.id !== achievement.id
                                            )
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </Suspense>
                ) : null}

                <div className="text-center space-y-2">
                    <p className="text-4xl">🎉</p>
                    <h1 className="text-2xl font-bold">¡Sesión completada!</h1>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold font-mono">
                                    {formatTime(elapsed)}
                                </p>
                                <p className="text-xs text-muted-foreground">Duración</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold font-mono">{totalSets}</p>
                                <p className="text-xs text-muted-foreground">Series</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold font-mono text-primary">
                                    {effectiveSets}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Series efectivas
                                </p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold font-mono">
                                    {Math.round(totalVolume).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">Volumen (kg)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Exercise breakdown */}
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                        Desglose por ejercicio
                    </h2>
                    {exerciseLogs
                        .filter((log) => log.sets.some((s) => s.weight && s.reps))
                        .map((log) => {
                            const completedSets = log.sets.filter(
                                (s) => s.weight && s.reps
                            );
                            return (
                                <Card key={log.exercise.id}>
                                    <CardContent className="py-3 px-4">
                                        <p className="text-sm font-medium">{log.exercise.name}</p>
                                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-mono">
                                            {completedSets.map((s, i) => (
                                                <span key={i} className={s.isEffective ? "text-primary" : ""}>
                                                    {s.weight}×{s.reps}
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>

                {analysis ? (
                    <div className="space-y-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">
                                    Sugerencias de progresión IA
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {analysis.progressions.length > 0 ? (
                                    analysis.progressions.map((suggestion, index) => (
                                        <div
                                            key={`${suggestion.exerciseName}-${index}`}
                                            className="flex items-start justify-between gap-3 rounded-md border border-border/80 px-3 py-2"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {suggestion.exerciseName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {suggestion.reason}
                                                </p>
                                            </div>
                                            <Badge variant="outline">
                                                {getProgressionBadge(suggestion)}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Sin sugerencias de progresión disponibles.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {analysis.stagnations.some((item) => item.isStagnated) ? (
                            <Card className="border-red-500/30 bg-red-500/5">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-red-600">
                                        Alertas de estancamiento
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {analysis.stagnations
                                        .filter((item) => item.isStagnated)
                                        .map((item, index) => (
                                            <p key={`${item.exerciseName}-${index}`} className="text-sm">
                                                ⚠️ {item.exerciseName}: {item.suggestion}
                                            </p>
                                        ))}
                                </CardContent>
                            </Card>
                        ) : null}

                        {analysis.junkVolume.hasJunkVolume ? (
                            <Card className="border-yellow-500/30 bg-yellow-500/5">
                                <CardContent className="pt-6">
                                    <p className="text-sm font-medium">
                                        Junk volume: {analysis.junkVolume.percentage}%
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {analysis.junkVolume.suggestion}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : null}

                        {analysis.alerts.length > 0 ? (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Alertas globales</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    {analysis.alerts.map((alert, index) => (
                                        <p key={index} className="text-xs text-muted-foreground">
                                            • {alert}
                                        </p>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                ) : null}

                <Button asChild className="w-full" size="lg">
                    <Link href="/train">← Volver a entrenar</Link>
                </Button>
            </div>
        );
    }

    // =================== NOT STARTED ===================
    if (!sessionStarted) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold tracking-tight">Nueva sesión</h1>
                <p className="text-sm text-muted-foreground">
                    {exercises.length} ejercicios disponibles. Registra tus series
                    durante el entrenamiento.
                </p>
                <Button onClick={startSession} className="w-full" size="lg">
                    ▶ Empezar sesión
                </Button>
            </div>
        );
    }

    // =================== IN PROGRESS ===================
    const currentLog = exerciseLogs[currentExerciseIndex];

    return (
        <div className="space-y-4">
            {/* Header with timer */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold tracking-tight">
                        Sesión en curso
                    </h1>
                    <p className="text-xs text-muted-foreground font-mono">
                        ⏱️ {formatTime(elapsed)} • {totalSets} series
                    </p>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={finishSession}
                    disabled={isSaving}
                >
                    {isSaving ? "Guardando..." : "Finalizar"}
                </Button>
            </div>

            {/* Rest Timer */}
            {isResting && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="py-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Descanso</p>
                        <p className="text-3xl font-bold font-mono">
                            {formatTime(restTimer)}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={skipRest}
                        >
                            Saltar →
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Exercise Navigation */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {exerciseLogs.map((log, idx) => {
                    const completedSets = log.sets.filter(
                        (s) => s.weight && s.reps
                    ).length;
                    return (
                        <Button
                            key={log.exercise.id}
                            variant={idx === currentExerciseIndex ? "default" : "outline"}
                            size="sm"
                            className="shrink-0 text-xs h-8"
                            onClick={() => setCurrentExerciseIndex(idx)}
                        >
                            {log.exercise.name.length > 12
                                ? log.exercise.name.slice(0, 12) + "…"
                                : log.exercise.name}
                            {completedSets > 0 && (
                                <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                                    {completedSets}
                                </Badge>
                            )}
                        </Button>
                    );
                })}
            </div>

            {/* Current exercise */}
            {currentLog && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            {currentLog.exercise.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {currentLog.exercise.minRepRange}-
                            {currentLog.exercise.maxRepRange} reps • RIR{" "}
                            {currentLog.exercise.recommendedRIR} •{" "}
                            {currentLog.exercise.equipment}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Column headers */}
                        <div className="grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-2 text-[10px] text-muted-foreground font-medium px-1">
                            <span>Set</span>
                            <span>Peso (kg)</span>
                            <span>Reps</span>
                            <span>RIR</span>
                            <span></span>
                        </div>

                        <Separator />

                        {/* Sets */}
                        {currentLog.sets.map((set, setIdx) => {
                            const isCompleted = set.weight && set.reps;
                            return (
                                <div
                                    key={setIdx}
                                    className="grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-2 items-center"
                                >
                                    <span
                                        className={`text-sm font-mono text-center ${isCompleted
                                                ? set.isEffective
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                                : ""
                                            }`}
                                    >
                                        {isCompleted ? (set.isEffective ? "✅" : "☑️") : set.setNumber}
                                    </span>
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="kg"
                                        value={set.weight}
                                        onChange={(e) =>
                                            updateSet(
                                                currentExerciseIndex,
                                                setIdx,
                                                "weight",
                                                e.target.value
                                            )
                                        }
                                        className="h-10 text-center font-mono"
                                        disabled={!!isCompleted}
                                    />
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="reps"
                                        value={set.reps}
                                        onChange={(e) =>
                                            updateSet(
                                                currentExerciseIndex,
                                                setIdx,
                                                "reps",
                                                e.target.value
                                            )
                                        }
                                        className="h-10 text-center font-mono"
                                        disabled={!!isCompleted}
                                    />
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="RIR"
                                        value={set.rir}
                                        onChange={(e) =>
                                            updateSet(
                                                currentExerciseIndex,
                                                setIdx,
                                                "rir",
                                                e.target.value
                                            )
                                        }
                                        className="h-10 text-center font-mono"
                                        disabled={!!isCompleted}
                                    />
                                    {!isCompleted ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-10 w-10 p-0"
                                            onClick={() =>
                                                saveSet(currentExerciseIndex, setIdx)
                                            }
                                            disabled={!set.weight || !set.reps}
                                        >
                                            ✓
                                        </Button>
                                    ) : (
                                        <span className="text-center text-xs text-muted-foreground">
                                            OK
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Live stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <Card>
                    <CardContent className="py-2">
                        <p className="text-lg font-bold font-mono">{totalSets}</p>
                        <p className="text-[10px] text-muted-foreground">Series</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-2">
                        <p className="text-lg font-bold font-mono text-primary">
                            {effectiveSets}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Efectivas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-2">
                        <p className="text-lg font-bold font-mono">
                            {Math.round(totalVolume / 1000)}k
                        </p>
                        <p className="text-[10px] text-muted-foreground">Vol (kg)</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
