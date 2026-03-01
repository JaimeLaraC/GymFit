interface VolumeSetInput {
  weight: number;
  reps: number;
}

interface EffectiveSetInput {
  rir: number | null;
}

interface DetectPrSetInput {
  weight: number;
  reps: number;
  rir: number | null;
}

interface HistoricalSetInput {
  weight: number;
  reps: number;
}

export interface PR {
  type: "weight" | "reps" | "e1rm" | "volume";
  value: number;
  previousBest: number;
  exerciseName: string;
  date: Date;
}

export function calculateE1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return weight;

  const e1rm = weight * (36 / (37 - reps));
  return Math.round(e1rm * 10) / 10;
}

export function calculateVolume(sets: VolumeSetInput[]): number {
  return sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
}

export function countEffectiveSets(sets: EffectiveSetInput[]): number {
  return sets.filter((set) => set.rir !== null && set.rir <= 3).length;
}

export function detectPRs(
  currentSets: DetectPrSetInput[],
  historicalSets: HistoricalSetInput[],
  exerciseName: string,
  date: Date
): PR[] {
  if (currentSets.length === 0) return [];

  const currentWeightPr = Math.max(...currentSets.map((set) => set.weight));
  const currentRepsPr = Math.max(...currentSets.map((set) => set.reps));
  const currentE1rmPr = Math.max(
    ...currentSets.map((set) => calculateE1RM(set.weight, set.reps))
  );
  const currentVolumePr = calculateVolume(currentSets);

  const historicalWeightPr =
    historicalSets.length > 0
      ? Math.max(...historicalSets.map((set) => set.weight))
      : 0;
  const historicalRepsPr =
    historicalSets.length > 0
      ? Math.max(...historicalSets.map((set) => set.reps))
      : 0;
  const historicalE1rmPr =
    historicalSets.length > 0
      ? Math.max(
          ...historicalSets.map((set) => calculateE1RM(set.weight, set.reps))
        )
      : 0;
  const historicalVolumePr =
    historicalSets.length > 0 ? calculateVolume(historicalSets) : 0;

  const prs: PR[] = [];

  if (currentWeightPr > historicalWeightPr)
    prs.push({
      type: "weight",
      value: currentWeightPr,
      previousBest: historicalWeightPr,
      exerciseName,
      date,
    });

  if (currentRepsPr > historicalRepsPr)
    prs.push({
      type: "reps",
      value: currentRepsPr,
      previousBest: historicalRepsPr,
      exerciseName,
      date,
    });

  if (currentE1rmPr > historicalE1rmPr)
    prs.push({
      type: "e1rm",
      value: currentE1rmPr,
      previousBest: historicalE1rmPr,
      exerciseName,
      date,
    });

  if (currentVolumePr > historicalVolumePr)
    prs.push({
      type: "volume",
      value: currentVolumePr,
      previousBest: historicalVolumePr,
      exerciseName,
      date,
    });

  return prs;
}
