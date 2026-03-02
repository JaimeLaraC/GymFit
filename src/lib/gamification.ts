import { prisma } from "@/lib/prisma";

export interface StreakResult {
  currentDays: number;
  currentWeeks: number;
  longestDays: number;
  isNewMilestone: boolean;
  milestone: number | null;
}

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

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

  // Si no entrenó en las últimas 48h, la racha actual está rota.
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
