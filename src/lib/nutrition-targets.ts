export interface NutritionTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  label: string;
}

interface GoalMacroConfig {
  caloriesPerKg: number;
  carbsPerKg: number;
  fatPerKg: number;
  fiberG: number;
}

const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Volumen (superávit)",
  definition: "Definición (déficit)",
  recomposition: "Recomposición (mantenimiento)",
  strength: "Fuerza (ligero superávit)",
};

const GOAL_CONFIGS: Record<string, GoalMacroConfig> = {
  hypertrophy: {
    caloriesPerKg: 35,
    carbsPerKg: 4.5,
    fatPerKg: 1,
    fiberG: 30,
  },
  definition: {
    caloriesPerKg: 25,
    carbsPerKg: 2.5,
    fatPerKg: 0.8,
    fiberG: 35,
  },
  recomposition: {
    caloriesPerKg: 30,
    carbsPerKg: 3.5,
    fatPerKg: 0.9,
    fiberG: 30,
  },
  strength: {
    caloriesPerKg: 32,
    carbsPerKg: 4,
    fatPerKg: 0.9,
    fiberG: 30,
  },
};

function getGoalKey(goal: string): string {
  if (goal in GOAL_CONFIGS) return goal;
  return "strength";
}

export function calculateTargets(weightKg: number, goal: string): NutritionTarget {
  const goalKey = getGoalKey(goal);
  const config = GOAL_CONFIGS[goalKey];

  const proteinPerKg = goalKey === "definition" || goalKey === "recomposition" ? 2.2 : 2.0;

  return {
    calories: Math.round(weightKg * config.caloriesPerKg),
    proteinG: Math.round(weightKg * proteinPerKg),
    carbsG: Math.round(weightKg * config.carbsPerKg),
    fatG: Math.round(weightKg * config.fatPerKg),
    fiberG: config.fiberG,
    label: GOAL_LABELS[goalKey],
  };
}
