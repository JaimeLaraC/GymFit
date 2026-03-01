export interface ScoreInput {
  weeklySessions: number[];
  weeklyEffectiveSets: number[];
  targetSetsPerWeek: number;
  targetSessionsPerWeek: number;
  e1rmTrends: {
    week: number;
    avgE1rm: number;
  }[];
  latestRecovery: {
    sleepHours: number | null;
    hrvMs: number | null;
    restingHrBpm: number | null;
    subjectiveEnergy: number | null;
  } | null;
}

export interface ScoreResult {
  total: number;
  performance: number;
  volume: number;
  consistency: number;
  recovery: number;
  trend: "up" | "stable" | "down";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value);
}

export function calculatePerformanceScore(e1rmTrends: ScoreInput["e1rmTrends"]): number {
  if (e1rmTrends.length < 2) return 70;

  const first = e1rmTrends[0].avgE1rm;
  const last = e1rmTrends[e1rmTrends.length - 1].avgE1rm;

  if (first <= 0 || last <= 0) return 70;

  const deltaPercent = ((last - first) / first) * 100;

  if (deltaPercent >= 5) return 100;
  if (deltaPercent >= 2) return round(85 + ((deltaPercent - 2) / 3) * 15);
  if (deltaPercent > -2 && deltaPercent < 2) return 70;

  return round(clamp(60 + (deltaPercent + 2) * 3, 40, 60));
}

export function calculateVolumeScore(weeklyEffectiveSets: number[], target: number): number {
  if (target <= 0) return 70;

  const recentSets = weeklyEffectiveSets.slice(-4);
  const avgSets = average(recentSets);
  const ratio = avgSets / target;

  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return round(70 + ((ratio - 0.8) / 0.2) * 30);
  if (ratio <= 0) return 0;

  return round(30 + (ratio / 0.8) * 40);
}

export function calculateConsistencyScore(weeklySessions: number[], target: number): number {
  if (target <= 0) return 70;

  const recentSessions = weeklySessions.slice(-4);
  const avgSessions = average(recentSessions);

  if (avgSessions >= target) return 100;
  if (avgSessions >= target - 1) return 75;
  if (avgSessions >= target - 2) return 50;
  if (avgSessions <= 0) return 0;

  return round(clamp((avgSessions / (target - 2)) * 50, 0, 50));
}

function sleepScore(hours: number | null): number {
  if (hours === null) return 70;
  if (hours >= 7) return 100;
  if (hours >= 6) return round(60 + (hours - 6) * 40);
  if (hours >= 5) return round(20 + (hours - 5) * 40);
  return 20;
}

function hrvScore(hrv: number | null): number {
  if (hrv === null) return 70;
  if (hrv >= 60) return 100;
  if (hrv >= 45) return 80;
  if (hrv >= 35) return 60;
  return 40;
}

function restingHrScore(restingHr: number | null): number {
  if (restingHr === null) return 70;
  if (restingHr <= 60) return 100;
  if (restingHr <= 70) return round(100 - ((restingHr - 60) / 10) * 40);
  if (restingHr <= 90) return round(60 - ((restingHr - 70) / 20) * 40);
  return 20;
}

function energyScore(energy: number | null): number {
  if (energy === null) return 70;
  return clamp(energy * 10, 10, 100);
}

export function calculateRecoveryScore(recovery: ScoreInput["latestRecovery"]): number {
  if (!recovery) return 70;

  const values = [
    sleepScore(recovery.sleepHours),
    hrvScore(recovery.hrvMs),
    restingHrScore(recovery.restingHrBpm),
    energyScore(recovery.subjectiveEnergy),
  ];

  return round(average(values));
}

export function calculateTrend(weeklyScores: number[]): "up" | "stable" | "down" {
  if (weeklyScores.length < 2) return "stable";

  const latest = weeklyScores[weeklyScores.length - 1];
  const previous = weeklyScores.slice(0, -1);
  const previousAverage = average(previous);
  const delta = latest - previousAverage;

  if (delta >= 3) return "up";
  if (delta <= -3) return "down";
  return "stable";
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const performance = calculatePerformanceScore(input.e1rmTrends);
  const volume = calculateVolumeScore(input.weeklyEffectiveSets, input.targetSetsPerWeek);
  const consistency = calculateConsistencyScore(
    input.weeklySessions,
    input.targetSessionsPerWeek
  );
  const recovery = calculateRecoveryScore(input.latestRecovery);

  const total = round(
    performance * 0.35 + volume * 0.25 + consistency * 0.25 + recovery * 0.15
  );

  const weeksCount = Math.max(
    input.weeklySessions.length,
    input.weeklyEffectiveSets.length,
    input.e1rmTrends.length
  );

  const weeklyScores: number[] = [];
  for (let index = 0; index < weeksCount; index++) {
    const weeklyPerformance = calculatePerformanceScore(
      input.e1rmTrends.slice(0, index + 1)
    );
    const weeklyVolume = calculateVolumeScore(
      input.weeklyEffectiveSets.slice(0, index + 1),
      input.targetSetsPerWeek
    );
    const weeklyConsistency = calculateConsistencyScore(
      input.weeklySessions.slice(0, index + 1),
      input.targetSessionsPerWeek
    );
    const weeklyTotal = round(
      weeklyPerformance * 0.35 +
        weeklyVolume * 0.25 +
        weeklyConsistency * 0.25 +
        recovery * 0.15
    );
    weeklyScores.push(weeklyTotal);
  }

  return {
    total: clamp(total, 0, 100),
    performance,
    volume,
    consistency,
    recovery,
    trend: calculateTrend(weeklyScores),
  };
}
