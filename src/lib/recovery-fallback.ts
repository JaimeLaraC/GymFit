import { prisma } from "@/lib/prisma";

export interface RecoveryData {
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  activeEnergyKcal?: number | null;
  spo2?: number | null;
  bodyTemperature?: number | null;
  respiratoryRate?: number | null;
  subjectiveEnergy?: number | null;
  stressLevel?: number | null;
}

const OBJECTIVE_FIELDS: (keyof RecoveryData)[] = [
  "hrvMs",
  "restingHrBpm",
  "sleepHours",
  "steps",
  "activeEnergyKcal",
  "spo2",
  "bodyTemperature",
  "respiratoryRate",
];

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getProxyValueFromSubjective(
  field: keyof RecoveryData,
  subjectiveEnergy: number
): number | null {
  if (field === "hrvMs") return round(25 + subjectiveEnergy * 4);
  if (field === "restingHrBpm") return round(78 - subjectiveEnergy * 2);
  if (field === "sleepHours") return round(4 + subjectiveEnergy * 0.4);
  return null;
}

export async function applyFallback(userId: string, data: RecoveryData): Promise<RecoveryData> {
  const hasNullFields = OBJECTIVE_FIELDS.some(
    (field) => data[field] === null || data[field] === undefined
  );
  if (!hasNullFields) return data;

  const recentSnapshots = await prisma.recoverySnapshot.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 7,
  });

  const hasFallbackData = recentSnapshots.length > 0;
  const fallbackSubjectiveEnergy =
    data.subjectiveEnergy ??
    recentSnapshots.find((snapshot) => snapshot.subjectiveEnergy !== null)?.subjectiveEnergy ??
    null;

  const filledData: RecoveryData = { ...data };

  for (const field of OBJECTIVE_FIELDS) {
    const currentValue = filledData[field];
    if (currentValue !== null && currentValue !== undefined) continue;

    if (hasFallbackData) {
      const values = recentSnapshots
        .map((snapshot) => snapshot[field] as number | null)
        .filter((value): value is number => value !== null);
      const avg = average(values);
      if (avg !== null) {
        filledData[field] = round(avg);
        continue;
      }
    }

    if (fallbackSubjectiveEnergy !== null) {
      const subjectiveProxy = getProxyValueFromSubjective(field, fallbackSubjectiveEnergy);
      if (subjectiveProxy !== null) {
        filledData[field] = subjectiveProxy;
        continue;
      }
    }

    delete filledData[field];
  }

  return filledData;
}
