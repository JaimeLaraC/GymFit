"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MealItem {
  id: string;
  description: string | null;
  photoUrl: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: string;
  verified: boolean;
  date: Date | string;
}

interface NutritionTargetSnapshot {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  label: string;
}

interface DailyNutritionProps {
  meals: MealItem[];
  targets: NutritionTargetSnapshot;
  goal: string;
}

interface ProgressRingProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  size?: number;
  stroke?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getProgressColor(progress: number): string {
  if (progress < 0.8) return "text-yellow-500";
  if (progress <= 1.1) return "text-green-500";
  return "text-red-500";
}

function ProgressRing({
  label,
  value,
  target,
  unit,
  size = 156,
  stroke = 12,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? value / target : 0;
  const normalizedProgress = clamp(progress, 0, 1.25);
  const dashOffset = circumference * (1 - normalizedProgress);
  const ringColorClass = getProgressColor(progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            className={ringColorClass}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono text-xl font-bold">{Math.round(value)}</p>
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xs font-medium ${ringColorClass}`}>
        {Math.round(progress * 100)}% objetivo
      </p>
    </div>
  );
}

export function DailyNutrition({ meals, targets, goal }: DailyNutritionProps) {
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + (meal.proteinG || 0), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + (meal.carbsG || 0), 0);
  const totalFat = meals.reduce((sum, meal) => sum + (meal.fatG || 0), 0);

  const isOverCalories = totalCalories > targets.calories * 1.1;
  const isProteinLow = totalProtein < targets.proteinG * 0.8;
  const hasMeals = meals.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nutrición</h1>
          <p className="text-xs text-muted-foreground">{targets.label} · {goal}</p>
        </div>
        <Link href="/nutrition/trends" className="text-sm text-muted-foreground">
          Tendencias →
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Seguimiento diario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <ProgressRing label="Calorías" value={totalCalories} target={targets.calories} unit="kcal" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ProgressRing
              label="Proteína"
              value={totalProtein}
              target={targets.proteinG}
              unit="g"
              size={100}
              stroke={8}
            />
            <ProgressRing
              label="Carbos"
              value={totalCarbs}
              target={targets.carbsG}
              unit="g"
              size={100}
              stroke={8}
            />
            <ProgressRing
              label="Grasa"
              value={totalFat}
              target={targets.fatG}
              unit="g"
              size={100}
              stroke={8}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {hasMeals ? (
          meals.map((meal) => (
            <Card key={meal.id}>
              <CardContent className="flex items-center gap-3 py-3">
                {meal.photoUrl ? (
                  <Image
                    src={meal.photoUrl}
                    alt={meal.description || "Comida"}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    🍽️
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{meal.description || "Comida"}</p>
                  <p className="text-xs text-muted-foreground">
                    {meal.calories ?? "—"} kcal · {meal.proteinG ?? "—"}g prot
                  </p>
                </div>
                <Badge variant={meal.source === "ai_photo" ? "secondary" : "outline"}>
                  {meal.source === "ai_photo" ? "🤖" : "✏️"}
                </Badge>
                {!meal.verified ? <Badge variant="destructive">⚠️</Badge> : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-3xl">🍽️</p>
            <p className="mt-2 text-sm">No has registrado comidas hoy</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="w-full">
          <Link href="/nutrition/add-photo">📸 Foto</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/nutrition/add-manual">✏️ Manual</Link>
        </Button>
      </div>

      {isProteinLow ? (
        <p className="text-xs text-orange-500">
          ⚠️ Faltan {Math.max(Math.round(targets.proteinG - totalProtein), 0)}g de proteína
        </p>
      ) : null}
      {isOverCalories ? (
        <p className="text-xs text-red-500">⚠️ Vas por encima del objetivo calórico diario.</p>
      ) : null}
    </div>
  );
}
