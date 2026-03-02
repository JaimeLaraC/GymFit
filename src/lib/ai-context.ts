import { calculateE1RM, countEffectiveSets } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { detectJunkVolume } from "@/lib/progression";
import { calculateScore } from "@/lib/score";

export interface UserContext {
  systemPrompt: string;
  userSummary: string;
}

interface WeeklyScoreWindow {
  key: string;
  sessions: number;
  effectiveSets: number;
  e1rms: number[];
}

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function createScoreWindows(startDate: Date): Map<string, WeeklyScoreWindow> {
  return new Map(
    Array.from({ length: 4 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index * 7);
      const key = getWeekStart(date).toISOString().slice(0, 10);

      return [
        key,
        {
          key,
          sessions: 0,
          effectiveSets: 0,
          e1rms: [],
        },
      ];
    })
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const [user, recentSessions, latestRecovery, latestMetrics, scoreSessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.session.findMany({
      where: { userId, status: "completed" },
      orderBy: { date: "desc" },
      take: 5,
      include: {
        workoutSets: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                primaryMuscle: true,
              },
            },
          },
        },
      },
    }),
    prisma.recoverySnapshot.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.session.findMany({
      where: {
        userId,
        status: "completed",
        date: {
          gte: (() => {
            const today = new Date();
            const thisWeek = getWeekStart(today);
            const fourWeeksAgo = new Date(thisWeek);
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 21);
            return fourWeeksAgo;
          })(),
        },
      },
      orderBy: { date: "asc" },
      include: {
        workoutSets: {
          select: {
            weight: true,
            reps: true,
            rir: true,
            exerciseId: true,
            exercise: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const today = new Date();
  const thisWeek = getWeekStart(today);
  const fourWeeksAgo = new Date(thisWeek);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 21);
  const weeklyWindows = createScoreWindows(fourWeeksAgo);

  for (const session of scoreSessions) {
    const key = getWeekStart(session.date).toISOString().slice(0, 10);
    const window = weeklyWindows.get(key);
    if (!window) continue;

    window.sessions += 1;
    window.effectiveSets += countEffectiveSets(session.workoutSets);

    for (const set of session.workoutSets) {
      window.e1rms.push(calculateE1RM(set.weight, set.reps));
    }
  }

  const weeklyData = [...weeklyWindows.values()].sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  const score = calculateScore({
    weeklySessions: weeklyData.map((week) => week.sessions),
    weeklyEffectiveSets: weeklyData.map((week) => week.effectiveSets),
    targetSetsPerWeek: 40,
    targetSessionsPerWeek: 4,
    e1rmTrends: weeklyData.map((week, index) => ({
      week: index,
      avgE1rm:
        week.e1rms.length > 0
          ? week.e1rms.reduce((sum, item) => sum + item, 0) / week.e1rms.length
          : 0,
    })),
    latestRecovery: latestRecovery
      ? {
          sleepHours: latestRecovery.sleepHours,
          hrvMs: latestRecovery.hrvMs,
          restingHrBpm: latestRecovery.restingHrBpm,
          subjectiveEnergy: latestRecovery.subjectiveEnergy,
          stressLevel: latestRecovery.stressLevel,
        }
      : null,
  });

  const topExercisesMap = new Map<string, { name: string; e1rm: number }>();
  for (const session of recentSessions) {
    for (const set of session.workoutSets) {
      const key = set.exerciseId;
      const e1rm = calculateE1RM(set.weight, set.reps);
      const previous = topExercisesMap.get(key);
      if (!previous || e1rm > previous.e1rm)
        topExercisesMap.set(key, { name: set.exercise.name, e1rm });
    }
  }

  const topExercises = [...topExercisesMap.values()]
    .sort((left, right) => right.e1rm - left.e1rm)
    .slice(0, 5);

  const recentWeeklySets = scoreSessions.flatMap((session) =>
    session.workoutSets.map((set) => ({ rir: set.rir }))
  );
  const junkVolume = detectJunkVolume(recentWeeklySets);

  const alerts: string[] = [];
  if ((latestRecovery?.sleepHours ?? 0) > 0 && (latestRecovery?.sleepHours ?? 0) < 7)
    alerts.push("Sueño por debajo de 7h.");
  if ((latestRecovery?.subjectiveEnergy ?? 10) <= 4) alerts.push("Energía subjetiva baja.");
  if (junkVolume.hasJunkVolume) alerts.push(junkVolume.suggestion);
  if (score.total < 60) alerts.push("Score global bajo: priorizar recuperación.");

  const lastSession = recentSessions[0];
  const lastSessionExercises = lastSession
    ? Object.values(
        lastSession.workoutSets.reduce(
          (
            accumulator: Record<
              string,
              {
                name: string;
                sets: string[];
              }
            >,
            set
          ) => {
            if (!accumulator[set.exerciseId]) {
              accumulator[set.exerciseId] = {
                name: set.exercise.name,
                sets: [],
              };
            }

            const rirText = set.rir !== null ? ` RIR ${set.rir}` : "";
            accumulator[set.exerciseId].sets.push(`${set.weight}x${set.reps}${rirText}`);
            return accumulator;
          },
          {}
        )
      )
    : [];

  const systemPrompt = `Eres un entrenador personal experto en hipertrofia y fuerza, basado en evidencia científica.
Tienes acceso a los datos reales del usuario y debes tomar decisiones racionales.
Nunca inventes datos. Si no tienes información suficiente, dilo claramente.
Prioriza: seguridad > recuperación > progresión > volumen.
Responde siempre en español. Sé conciso y directo.`;

  const userSummary = `[CONTEXTO DEL USUARIO]
- Nombre: ${user?.name ?? "Usuario"}
- Nivel: ${user?.level ?? "beginner"}
- Objetivo: ${user?.goal ?? "hypertrophy"}
- Score global: ${score.total}/100 (tendencia: ${score.trend})
- Peso actual: ${latestMetrics?.weightKg ? `${latestMetrics.weightKg.toFixed(1)} kg` : "N/D"}

[ÚLTIMO ENTRENAMIENTO]
${
  lastSession
    ? `- Fecha: ${formatDate(lastSession.date)}
- Duración: ${lastSession.durationMin ?? "N/D"} min
- Ejercicios:
${lastSessionExercises.map((exercise) => `  - ${exercise.name}: ${exercise.sets.join(", ")}`).join("\n")}`
    : "- Sin sesiones recientes."
}

[RECUPERACIÓN]
- Sueño: ${latestRecovery?.sleepHours ?? "N/D"} h
- HRV: ${latestRecovery?.hrvMs ?? "N/D"} ms
- FC reposo: ${latestRecovery?.restingHrBpm ?? "N/D"} bpm
- Energía subjetiva: ${latestRecovery?.subjectiveEnergy ?? "N/D"}/10
- Estrés percibido: ${latestRecovery?.stressLevel ?? "N/D"}/10
- Pasos: ${latestRecovery?.steps ?? "N/D"}
- Energía activa: ${latestRecovery?.activeEnergyKcal ?? "N/D"} kcal
- SpO₂: ${latestRecovery?.spo2 ?? "N/D"}%
- Temperatura: ${latestRecovery?.bodyTemperature ?? "N/D"} °C
- Frecuencia respiratoria: ${latestRecovery?.respiratoryRate ?? "N/D"}
- Fuente: ${latestRecovery?.source ?? "N/D"}

[TENDENCIA 4 SEMANAS]
- Sesiones por semana: ${weeklyData.map((item) => item.sessions).join(" / ")}
- Series efectivas por semana: ${weeklyData.map((item) => item.effectiveSets).join(" / ")}
- Top e1RM recientes:
${topExercises.length > 0 ? topExercises.map((item) => `  - ${item.name}: ${item.e1rm.toFixed(1)} kg`).join("\n") : "  - Sin datos suficientes"}

[ALERTAS ACTIVAS]
${alerts.length > 0 ? alerts.map((alert) => `- ${alert}`).join("\n") : "- Sin alertas activas."}`;

  return {
    systemPrompt,
    userSummary,
  };
}
