export interface RecompositionResult {
  isRecomposition: boolean;
  weightDelta: number;
  strengthDelta: number;
  message: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateEMA(values: (number | null)[], alpha: number = 0.1): number[] {
  const result: number[] = [];
  let ema: number | null = null;

  for (const value of values) {
    if (value === null) continue;

    if (ema === null) ema = value;
    else ema = alpha * value + (1 - alpha) * ema;

    result.push(round(ema));
  }

  return result;
}

export function detectRecomposition(
  weights: { date: Date; weightKg: number }[],
  e1rmTrends: { week: number; avgE1rm: number }[]
): RecompositionResult {
  if (weights.length < 2 || e1rmTrends.length < 2) {
    return {
      isRecomposition: false,
      weightDelta: 0,
      strengthDelta: 0,
      message: "Aún no hay suficientes datos para detectar recomposición.",
    };
  }

  const sortedWeights = [...weights].sort((a, b) => a.date.getTime() - b.date.getTime());
  const cutoff = new Date(sortedWeights[sortedWeights.length - 1].date);
  cutoff.setDate(cutoff.getDate() - 28);

  const inRangeWeights = sortedWeights.filter((weight) => weight.date >= cutoff);
  if (inRangeWeights.length < 2) {
    return {
      isRecomposition: false,
      weightDelta: 0,
      strengthDelta: 0,
      message: "Se necesitan al menos 2 mediciones en 4 semanas.",
    };
  }

  const firstWeight = inRangeWeights[0].weightKg;
  const lastWeight = inRangeWeights[inRangeWeights.length - 1].weightKg;
  const weightDelta = round(lastWeight - firstWeight);

  const firstE1rm = e1rmTrends[0].avgE1rm;
  const lastE1rm = e1rmTrends[e1rmTrends.length - 1].avgE1rm;
  const strengthDelta = firstE1rm > 0 ? round(((lastE1rm - firstE1rm) / firstE1rm) * 100) : 0;

  const isWeightStable = Math.abs(weightDelta) <= 1;
  const isStrengthUp = strengthDelta >= 3;
  const isRecomposition = isWeightStable && isStrengthUp;

  return {
    isRecomposition,
    weightDelta,
    strengthDelta,
    message: isRecomposition
      ? "Peso estable con mejora de fuerza: posible recomposición corporal."
      : "Sin señales claras de recomposición por ahora.",
  };
}
