import { calculateE1RM } from "@/lib/calculations";

export interface ProgressionInput {
  exerciseId: string;
  exerciseName: string;
  method: "standard" | "double_progression" | "top_set_backoff" | "rest_pause";
  targetMinReps: number;
  targetMaxReps: number;
  targetRIR: number;
  lastSets: {
    weight: number;
    reps: number;
    rir: number | null;
  }[];
  historicalSessions: {
    date: Date;
    sets: {
      weight: number;
      reps: number;
      rir: number | null;
    }[];
  }[];
}

export interface ProgressionSuggestion {
  exerciseName: string;
  type: "increase_weight" | "maintain" | "decrease_weight" | "deload" | "change_exercise";
  newWeight: number | null;
  newRepRange: {
    min: number;
    max: number;
  } | null;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface StagnationResult {
  exerciseName: string;
  isStagnated: boolean;
  weeksSinceProgress: number;
  suggestion: string;
}

export interface JunkVolumeResult {
  hasJunkVolume: boolean;
  junkSets: number;
  totalSets: number;
  percentage: number;
  suggestion: string;
}

export interface PostSessionAnalysis {
  progressions: ProgressionSuggestion[];
  stagnations: StagnationResult[];
  junkVolume: JunkVolumeResult;
  alerts: string[];
}

export interface AnalyzeSessionInput {
  exercises: ProgressionInput[];
  weeklySets: {
    rir: number | null;
  }[];
  latestRecovery?: {
    sleepHours: number | null;
    hrvMs: number | null;
    restingHrBpm: number | null;
    subjectiveEnergy: number | null;
  } | null;
}

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function getSessionBestE1RM(session: ProgressionInput["historicalSessions"][number]): number {
  if (session.sets.length === 0) return 0;
  return Math.max(...session.sets.map((set) => calculateE1RM(set.weight, set.reps)));
}

function getIncrement(weight: number): number {
  return weight >= 60 ? 2.5 : 1.25;
}

export function evaluateDoubleProgression(input: ProgressionInput): ProgressionSuggestion {
  const { lastSets, targetMaxReps, targetMinReps, targetRIR } = input;
  if (lastSets.length === 0) {
    return {
      exerciseName: input.exerciseName,
      type: "maintain",
      newWeight: null,
      newRepRange: null,
      reason: "Sin datos suficientes del último entrenamiento para progresar.",
      confidence: "low",
    };
  }

  const avgRIR =
    lastSets.reduce((sum, set) => sum + (set.rir ?? targetRIR), 0) / lastSets.length;
  const allAtMaxReps = lastSets.every((set) => set.reps >= targetMaxReps);
  const weight = lastSets[0].weight;

  if (allAtMaxReps && avgRIR <= targetRIR + 1) {
    const increment = getIncrement(weight);
    const nextWeight = roundToNearestHalf(weight + increment);
    return {
      exerciseName: input.exerciseName,
      type: "increase_weight",
      newWeight: nextWeight,
      newRepRange: { min: targetMinReps, max: targetMaxReps },
      reason: `Cumpliste el rango alto con RIR controlado. Sube a ${nextWeight} kg y vuelve al rango bajo.`,
      confidence: "high",
    };
  }

  const recentBelowMin = input.historicalSessions
    .slice(0, 2)
    .filter((session) => session.sets.some((set) => set.reps < targetMinReps));

  if (recentBelowMin.length >= 2) {
    const reduction = roundToNearestHalf(weight * 0.1);
    const nextWeight = roundToNearestHalf(Math.max(weight - reduction, 0));
    return {
      exerciseName: input.exerciseName,
      type: "decrease_weight",
      newWeight: nextWeight,
      newRepRange: { min: targetMinReps, max: targetMaxReps },
      reason: `No alcanzas el mínimo de ${targetMinReps} reps en sesiones consecutivas. Baja a ${nextWeight} kg y reinicia.`,
      confidence: "high",
    };
  }

  return {
    exerciseName: input.exerciseName,
    type: "maintain",
    newWeight: roundToNearestHalf(weight),
    newRepRange: null,
    reason: `Mantén ${roundToNearestHalf(weight)} kg y busca completar ${targetMaxReps} reps por serie.`,
    confidence: "medium",
  };
}

export function detectStagnation(input: ProgressionInput): StagnationResult {
  const sessions = [...input.historicalSessions].sort(
    (left, right) => left.date.getTime() - right.date.getTime()
  );

  if (sessions.length < 3) {
    return {
      exerciseName: input.exerciseName,
      isStagnated: false,
      weeksSinceProgress: 0,
      suggestion: "Aún no hay suficientes sesiones para detectar meseta.",
    };
  }

  const e1rmBySession = sessions.map((session) => ({
    date: session.date,
    e1rm: getSessionBestE1RM(session),
  }));

  let bestE1rm = e1rmBySession[0].e1rm;
  let lastProgressDate = e1rmBySession[0].date;

  for (const item of e1rmBySession.slice(1)) {
    if (item.e1rm > bestE1rm + 0.5) {
      bestE1rm = item.e1rm;
      lastProgressDate = item.date;
    }
  }

  const latestDate = e1rmBySession[e1rmBySession.length - 1].date;
  const weeksSinceProgress = Math.max(
    0,
    Math.floor((latestDate.getTime() - lastProgressDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  );
  const isStagnated = weeksSinceProgress >= 3;

  if (!isStagnated) {
    return {
      exerciseName: input.exerciseName,
      isStagnated: false,
      weeksSinceProgress,
      suggestion: "La progresión sigue activa en este ejercicio.",
    };
  }

  if (weeksSinceProgress >= 5) {
    return {
      exerciseName: input.exerciseName,
      isStagnated: true,
      weeksSinceProgress,
      suggestion:
        "Meseta prolongada. Considera deload corto y volver con variante o rango de reps distinto.",
    };
  }

  return {
    exerciseName: input.exerciseName,
    isStagnated: true,
    weeksSinceProgress,
    suggestion:
      "Meseta detectada. Prueba ajustar rango de reps, cambiar variante o subir frecuencia semanal.",
  };
}

export function detectJunkVolume(weeklySets: { rir: number | null }[]): JunkVolumeResult {
  const total = weeklySets.length;
  const junk = weeklySets.filter((set) => set.rir !== null && set.rir > 4).length;
  const percentage = total > 0 ? Math.round((junk / total) * 100) : 0;

  return {
    hasJunkVolume: percentage > 30,
    junkSets: junk,
    totalSets: total,
    percentage,
    suggestion:
      percentage > 30
        ? `${percentage}% de tus series son junk volume (RIR > 4). Reduce series o sube intensidad.`
        : "",
  };
}

function evaluateProgression(input: ProgressionInput): ProgressionSuggestion {
  if (input.method === "double_progression" || input.method === "standard")
    return evaluateDoubleProgression(input);

  if (input.method === "top_set_backoff") {
    const topSet = input.lastSets[0] ? [input.lastSets[0]] : [];
    return evaluateDoubleProgression({
      ...input,
      lastSets: topSet.length > 0 ? topSet : input.lastSets,
    });
  }

  if (input.method === "rest_pause") {
    const suggestion = evaluateDoubleProgression(input);
    return {
      ...suggestion,
      reason: `${suggestion.reason} En rest-pause prioriza técnica estable y descanso fijo.`,
      confidence: suggestion.confidence === "high" ? "medium" : suggestion.confidence,
    };
  }

  return evaluateDoubleProgression(input);
}

export function analyzeSession(input: AnalyzeSessionInput): PostSessionAnalysis {
  const progressions = input.exercises.map((exercise) => evaluateProgression(exercise));
  const stagnations = input.exercises.map((exercise) => detectStagnation(exercise));
  const junkVolume = detectJunkVolume(input.weeklySets);

  const alerts: string[] = [];

  for (const stagnation of stagnations) {
    if (!stagnation.isStagnated) continue;
    alerts.push(`${stagnation.exerciseName}: estancado ${stagnation.weeksSinceProgress} semanas.`);
  }

  if (junkVolume.hasJunkVolume) alerts.push(junkVolume.suggestion);

  if ((input.latestRecovery?.sleepHours ?? 0) > 0 && (input.latestRecovery?.sleepHours ?? 0) < 6)
    alerts.push("Sueño bajo (<6h): reduce fatiga y evita series al fallo hoy.");

  if (
    (input.latestRecovery?.subjectiveEnergy ?? 10) <= 4 ||
    (input.latestRecovery?.restingHrBpm ?? 0) >= 70
  )
    alerts.push("Recuperación comprometida: considera bajar volumen 10-20% esta semana.");

  return {
    progressions,
    stagnations,
    junkVolume,
    alerts,
  };
}
