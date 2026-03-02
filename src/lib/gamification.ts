import { calculateE1RM } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

export interface StreakResult {
  currentDays: number;
  currentWeeks: number;
  longestDays: number;
  isNewMilestone: boolean;
  milestone: number | null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalSessions: number;
  totalVolume: number;
  bestBenchE1rm: number;
  bestSquatE1rm: number;
  bestDeadliftE1rm: number;
  longestStreak: number;
  totalPRs: number;
  firstSessionDate: Date | null;
  bodyweightChange: number;
}

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_session",
    name: "Primer Entreno",
    description: "Completaste tu primera sesión",
    icon: "🎯",
    condition: (stats) => stats.totalSessions >= 1,
  },
  {
    id: "sessions_10",
    name: "Constante",
    description: "10 sesiones completadas",
    icon: "💪",
    condition: (stats) => stats.totalSessions >= 10,
  },
  {
    id: "sessions_50",
    name: "Dedicado",
    description: "50 sesiones completadas",
    icon: "🔥",
    condition: (stats) => stats.totalSessions >= 50,
  },
  {
    id: "sessions_100",
    name: "Centurión",
    description: "100 sesiones completadas",
    icon: "🏆",
    condition: (stats) => stats.totalSessions >= 100,
  },
  {
    id: "volume_10k",
    name: "10 Toneladas",
    description: "10.000 kg de volumen total acumulado",
    icon: "⚡",
    condition: (stats) => stats.totalVolume >= 10000,
  },
  {
    id: "volume_100k",
    name: "100 Toneladas",
    description: "100.000 kg de volumen total, eres una bestia",
    icon: "🦁",
    condition: (stats) => stats.totalVolume >= 100000,
  },
  {
    id: "bench_100",
    name: "Club de los 100",
    description: "e1RM de press banca >= 100 kg",
    icon: "🏋️",
    condition: (stats) => stats.bestBenchE1rm >= 100,
  },
  {
    id: "squat_140",
    name: "Piernas de Acero",
    description: "e1RM de sentadilla >= 140 kg",
    icon: "🦵",
    condition: (stats) => stats.bestSquatE1rm >= 140,
  },
  {
    id: "deadlift_180",
    name: "Peso Muerto Elite",
    description: "e1RM de peso muerto >= 180 kg",
    icon: "💀",
    condition: (stats) => stats.bestDeadliftE1rm >= 180,
  },
  {
    id: "streak_30",
    name: "Habito de Hierro",
    description: "Racha de 30 dias entrenando",
    icon: "📅",
    condition: (stats) => stats.longestStreak >= 30,
  },
  {
    id: "prs_10",
    name: "Cazador de PRs",
    description: "10 records personales batidos",
    icon: "🎖️",
    condition: (stats) => stats.totalPRs >= 10,
  },
];

function normalizeToDay(date: Date): number {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate.getTime();
}

function calculateLongestStreak(uniqueDaysDesc: number[]): number {
  if (uniqueDaysDesc.length === 0) return 0;

  let longestDays = 1;
  let ongoingDays = 1;

  for (let index = 1; index < uniqueDaysDesc.length; index += 1) {
    const diffDays = (uniqueDaysDesc[index - 1] - uniqueDaysDesc[index]) / 86400000;
    if (diffDays <= 2) {
      ongoingDays += 1;
      longestDays = Math.max(longestDays, ongoingDays);
      continue;
    }

    ongoingDays = 1;
  }

  return longestDays;
}

function calculateCurrentStreak(uniqueDaysDesc: number[]): number {
  if (uniqueDaysDesc.length === 0) return 0;

  const today = normalizeToDay(new Date());
  const latestSessionDay = uniqueDaysDesc[0];
  const daysFromToday = (today - latestSessionDay) / 86400000;

  if (daysFromToday > 2) return 0;

  let currentDays = 1;

  for (let index = 1; index < uniqueDaysDesc.length; index += 1) {
    const diffDays = (uniqueDaysDesc[index - 1] - uniqueDaysDesc[index]) / 86400000;
    if (diffDays <= 2) {
      currentDays += 1;
      continue;
    }

    break;
  }

  return currentDays;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getBestLiftE1rm(
  workoutSets: { weight: number; reps: number; exercise: { name: string } }[],
  liftKeywords: string[]
): number {
  const matchingSets = workoutSets.filter((set) => {
    const normalizedName = normalizeText(set.exercise.name);
    return liftKeywords.some((keyword) => normalizedName.includes(keyword));
  });

  if (matchingSets.length === 0) return 0;

  return matchingSets.reduce((bestValue, set) => {
    const e1rm = calculateE1RM(set.weight, set.reps);
    return Math.max(bestValue, e1rm);
  }, 0);
}

export async function calculateStreak(userId: string): Promise<StreakResult> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      status: "completed",
    },
    orderBy: {
      date: "desc",
    },
    select: {
      date: true,
    },
  });

  if (sessions.length === 0) {
    return {
      currentDays: 0,
      currentWeeks: 0,
      longestDays: 0,
      isNewMilestone: false,
      milestone: null,
    };
  }

  const uniqueDaysDesc = [...new Set(sessions.map((session) => normalizeToDay(session.date)))].sort(
    (dateA, dateB) => dateB - dateA
  );

  const currentDays = calculateCurrentStreak(uniqueDaysDesc);
  const longestDays = calculateLongestStreak(uniqueDaysDesc);
  const milestone = STREAK_MILESTONES.find(
    (milestoneValue) => currentDays >= milestoneValue && currentDays - 1 < milestoneValue
  );

  return {
    currentDays,
    currentWeeks: Math.floor(currentDays / 7),
    longestDays,
    isNewMilestone: Boolean(milestone),
    milestone: milestone ?? null,
  };
}

async function getUserStats(userId: string): Promise<UserStats> {
  const [sessions, firstSession, firstBodyMetric, latestBodyMetric, totalPRs, streak] =
    await Promise.all([
      prisma.session.findMany({
        where: {
          userId,
          status: "completed",
        },
        include: {
          workoutSets: {
            select: {
              weight: true,
              reps: true,
              exercise: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.session.findFirst({
        where: {
          userId,
          status: "completed",
        },
        orderBy: {
          date: "asc",
        },
        select: {
          date: true,
        },
      }),
      prisma.bodyMetric.findFirst({
        where: {
          userId,
          weightKg: {
            not: null,
          },
        },
        orderBy: {
          date: "asc",
        },
        select: {
          weightKg: true,
        },
      }),
      prisma.bodyMetric.findFirst({
        where: {
          userId,
          weightKg: {
            not: null,
          },
        },
        orderBy: {
          date: "desc",
        },
        select: {
          weightKg: true,
        },
      }),
      prisma.achievement.count({
        where: {
          userId,
          type: "pr",
        },
      }),
      calculateStreak(userId),
    ]);

  const allWorkoutSets = sessions.flatMap((session) => session.workoutSets);

  const totalVolume = allWorkoutSets.reduce(
    (sum, workoutSet) => sum + workoutSet.weight * workoutSet.reps,
    0
  );

  const bestBenchE1rm = getBestLiftE1rm(allWorkoutSets, ["press banca", "bench press", "banca"]);
  const bestSquatE1rm = getBestLiftE1rm(allWorkoutSets, ["sentadilla", "squat"]);
  const bestDeadliftE1rm = getBestLiftE1rm(allWorkoutSets, ["peso muerto", "deadlift"]);

  const initialBodyweight = firstBodyMetric?.weightKg ?? null;
  const currentBodyweight = latestBodyMetric?.weightKg ?? null;
  const bodyweightChange =
    initialBodyweight !== null && currentBodyweight !== null
      ? Math.round((currentBodyweight - initialBodyweight) * 10) / 10
      : 0;

  return {
    totalSessions: sessions.length,
    totalVolume: Math.round(totalVolume),
    bestBenchE1rm,
    bestSquatE1rm,
    bestDeadliftE1rm,
    longestStreak: streak.longestDays,
    totalPRs,
    firstSessionDate: firstSession?.date ?? null,
    bodyweightChange,
  };
}

export async function checkAndUnlockBadges(userId: string): Promise<string[]> {
  const userStats = await getUserStats(userId);

  const existingBadges = await prisma.achievement.findMany({
    where: {
      userId,
      type: "badge",
    },
    select: {
      name: true,
    },
  });

  const unlockedBadgeNames = new Set(existingBadges.map((badge) => badge.name));
  const newBadges: string[] = [];

  for (const badgeDefinition of BADGE_DEFINITIONS) {
    const hasUnlockedBadge = unlockedBadgeNames.has(badgeDefinition.name);
    const shouldUnlockBadge = badgeDefinition.condition(userStats);

    if (!hasUnlockedBadge && shouldUnlockBadge) {
      await prisma.achievement.create({
        data: {
          userId,
          type: "badge",
          name: badgeDefinition.name,
          description: badgeDefinition.description,
          value: {
            id: badgeDefinition.id,
            icon: badgeDefinition.icon,
          },
        },
      });

      newBadges.push(`${badgeDefinition.icon} ${badgeDefinition.name}`);
    }
  }

  return newBadges;
}
