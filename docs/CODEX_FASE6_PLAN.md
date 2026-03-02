# Plan de Implementación — Fase 6: Nutrición

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Documentación de referencia OBLIGATORIA

1. **`.agents/skills/nextjs-react-typescript/SKILL.md`** — Patrones de Next.js/React/TS
2. **`.agents/skills/git-workflow/SKILL.md`** — Conventional Commits + Git Flow
3. **`.agents/skills/pwa-development/SKILL.md`** — Caching, offline, background sync

**Lee las 3 referencias ANTES de escribir código.**

---

## Contexto del Proyecto

### Stack
- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Prisma 6 · PostgreSQL · Recharts · OpenAI SDK

### Archivos existentes relevantes
| Archivo | Propósito |
|---------|-----------|
| `src/lib/openai.ts` | Singleton OpenAI SDK (reutilizar para Vision) |
| `src/app/api/nutrition/` | No existe aún — **CREAR** |
| `src/app/(dashboard)/nutrition/` | No existe aún — **CREAR** |
| `.gitignore` | Ya ignora `public/uploads/` (Fase 3) |

### Modelo Prisma (NO modificar schema)
```prisma
model Meal {
  id, userId, date (DateTime), photoUrl?, description?, calories?, proteinG?,
  carbsG?, fatG?, fiberG?, source ("ai_photo"|"manual"), verified (Boolean),
  notes?, createdAt
  @@index([userId, date])
}

model User {
  goal String @default("hypertrophy") // hypertrophy | strength | recomposition | definition
}
```

---

## Reglas de las skills aplicadas

### Skill: `nextjs-react-typescript`
- **Interfaces** sobre types. Evitar enums → usar maps o union literals
- **Named exports** → `export function DailyNutrition()`, no `export default`
- **Minimizar `'use client'`** → Server Components para data fetching (página de tendencias, daily overview). `'use client'` solo para: formularios (add-photo, add-manual), gráficas interactivas
- **Wrap client components en `<Suspense>`** con fallback skeleton
- **Dynamic loading** con `next/dynamic` para `MacroTrendChart` y anillos de progreso
- **`function` keyword** para funciones puras (`calculateTargets`, helpers)
- **Variables descriptivas**: `isAnalyzing`, `hasPhoto`, `isVerified`, `isOverCalories`
- **Organización**: componente exportado → subcomponentes → helpers → tipos
- **Mobile-first** con Tailwind: diseñar para 390px, luego `sm:`, `md:`

### Skill: `git-workflow`
- **Conventional Commits** con tipo+scope+subject+body:
  ```
  feat(nutrition): implemento análisis de foto de comida con GPT Vision

  Endpoint POST /api/nutrition/analyze acepta FormData con imagen.
  Guarda foto en public/uploads/meals/, analiza con GPT Vision,
  devuelve macros estimados con nivel de confianza.
  Crea registro Meal con source="ai_photo", verified=false.
  ```
- **Atomic commits** por funcionalidad
- **Git Flow** desde `develop`, branch `feature/nutrition`

### Skill: `pwa-development`
- **Cache First** para fotos de comida (`/uploads/meals/*`) → imágenes estáticas, no cambian
- **Network First** para `/api/nutrition/meals` → datos frescos con fallback a cache
- **Offline detection** en formularios → mostrar aviso si offline
- **Background Sync** para POST de comidas manuales → si falla, reintentar al volver online

---

## Git: Branch y commits

```bash
git checkout develop && git pull origin develop
git checkout -b feature/nutrition
```

### Commits (en orden):
```bash
# 1
git commit -m "feat(nutrition): implemento análisis de foto de comida con GPT Vision

Endpoint POST /api/nutrition/analyze acepta FormData con imagen.
Guarda en public/uploads/meals/, analiza con GPT Vision en JSON mode.
Crea Meal con source='ai_photo', verified=false."

# 2
git commit -m "feat(nutrition): implemento registro manual de comidas y API REST

POST /api/nutrition/meals con validación Zod.
PUT/DELETE /api/nutrition/meals/[id] para editar y verificar.
GET con totales del día (calorías, macros)."

# 3
git commit -m "feat(nutrition): implemento seguimiento diario con anillos de progreso

Página /nutrition con anillos de calorías/proteína/carbos/grasa,
lista de comidas del día, botones de captura y registro manual.
Client component wrapeado en Suspense."

# 4
git commit -m "feat(nutrition): implemento objetivos nutricionales por fase

Utility calculateTargets() con fórmulas por goal del usuario.
Hypertrophy: 35 kcal/kg, Definition: 25 kcal/kg, etc.
Proteína siempre 1.8-2.2g/kg según la evidencia."

# 5
git commit -m "feat(nutrition): implemento tendencias semanales con gráficas

BarChart apilado de macros por día (últimas 4 semanas).
ReferenceLine del objetivo calórico. Tabla resumen semanal.
Dynamic loading para gráficas."

# 6
git commit -m "docs(roadmap): marco la Fase 6 como completada"
```

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/nutrition -m "merge: integro módulo de nutrición en develop"
git push origin feature/nutrition && git push origin develop
```

---

## Paso 1: Objetivos Nutricionales (Utility)

### [NEW] `src/lib/nutrition-targets.ts`

```typescript
// Skill: nextjs-react-typescript → interfaces, function keyword, no enums

interface NutritionTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  label: string;
}

// Map en lugar de enum (skill)
const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Volumen (superávit)",
  definition: "Definición (déficit)",
  recomposition: "Recomposición (mantenimiento)",
  strength: "Fuerza (ligero superávit)",
};

function calculateTargets(weightKg: number, goal: string): NutritionTarget {
  const proteinPerKg = goal === "definition" || goal === "recomposition" ? 2.2 : 2.0;
  const proteinG = Math.round(weightKg * proteinPerKg);

  const goalConfigs: Record<string, Omit<NutritionTarget, "proteinG" | "label">> = {
    hypertrophy: {
      calories: Math.round(weightKg * 35),
      carbsG: Math.round(weightKg * 4.5),
      fatG: Math.round(weightKg * 1.0),
      fiberG: 30,
    },
    definition: {
      calories: Math.round(weightKg * 25),
      carbsG: Math.round(weightKg * 2.5),
      fatG: Math.round(weightKg * 0.8),
      fiberG: 35,
    },
    recomposition: {
      calories: Math.round(weightKg * 30),
      carbsG: Math.round(weightKg * 3.5),
      fatG: Math.round(weightKg * 0.9),
      fiberG: 30,
    },
    strength: {
      calories: Math.round(weightKg * 32),
      carbsG: Math.round(weightKg * 4.0),
      fatG: Math.round(weightKg * 0.9),
      fiberG: 30,
    },
  };

  const config = goalConfigs[goal] || goalConfigs.strength;

  return {
    ...config,
    proteinG,
    label: GOAL_LABELS[goal] || GOAL_LABELS.strength,
  };
}

export { calculateTargets };
export type { NutritionTarget };
```

---

## Paso 2: API de Análisis con GPT Vision

### [NEW] `src/app/api/nutrition/analyze/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { openai, AI_MODEL } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const userId = (formData.get("userId") as string) || "default-user";

  if (!file) {
    return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
  }

  // 1. Guardar imagen
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const dir = join(process.cwd(), "public", "uploads", "meals");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  const photoUrl = `/uploads/meals/${filename}`;

  // 2. Analizar con GPT Vision
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `Eres un nutricionista experto. Analiza la foto de comida y estima los valores nutricionales.
Responde SOLO en JSON con este formato:
{"description":"descripción breve en español","calories":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"confidence":"high"|"medium"|"low","notes":"notas adicionales"}
Sé conservador. Si no puedes identificar un alimento, indica confidence:"low".`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta comida:" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const analysis = JSON.parse(response.choices[0].message.content || "{}");

    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(),
        photoUrl,
        description: analysis.description || null,
        calories: analysis.calories || null,
        proteinG: analysis.proteinG || null,
        carbsG: analysis.carbsG || null,
        fatG: analysis.fatG || null,
        fiberG: analysis.fiberG || null,
        source: "ai_photo",
        verified: false,
      },
    });

    return NextResponse.json({ meal, analysis }, { status: 201 });
  } catch (error) {
    // Guardar la comida sin análisis si la IA falla
    const meal = await prisma.meal.create({
      data: { userId, date: new Date(), photoUrl, source: "ai_photo", verified: false },
    });
    return NextResponse.json(
      { meal, error: "Error al analizar. Puedes añadir los macros manualmente." },
      { status: 201 }
    );
  }
}
```

---

## Paso 3: API CRUD de Comidas

### [NEW] `src/app/api/nutrition/meals/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const mealSchema = z.object({
  userId: z.string().default("default-user"),
  description: z.string().min(1),
  calories: z.number().positive().optional(),
  proteinG: z.number().min(0).optional(),
  carbsG: z.number().min(0).optional(),
  fatG: z.number().min(0).optional(),
  fiberG: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = mealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meal = await prisma.meal.create({
    data: { ...parsed.data, date: new Date(), source: "manual", verified: true },
  });

  return NextResponse.json(meal, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const date = searchParams.get("date"); // YYYY-MM-DD

  const startOfDay = date ? new Date(date) : new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const meals = await prisma.meal.findMany({
    where: { userId, date: { gte: startOfDay, lte: endOfDay } },
    orderBy: { date: "asc" },
  });

  // Totales del día
  const totals = {
    calories: meals.reduce((s, m) => s + (m.calories || 0), 0),
    proteinG: meals.reduce((s, m) => s + (m.proteinG || 0), 0),
    carbsG: meals.reduce((s, m) => s + (m.carbsG || 0), 0),
    fatG: meals.reduce((s, m) => s + (m.fatG || 0), 0),
    fiberG: meals.reduce((s, m) => s + (m.fiberG || 0), 0),
  };

  return NextResponse.json({ meals, totals });
}
```

### [NEW] `src/app/api/nutrition/meals/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT: Editar comida (verificar/corregir macros post-IA)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const meal = await prisma.meal.update({
    where: { id },
    data: { ...body, verified: true },
  });

  return NextResponse.json(meal);
}

// DELETE
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.meal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

---

## Paso 4: Página Diaria de Nutrición

### [NEW] `src/app/(dashboard)/nutrition/page.tsx` (Server Component)

```typescript
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { calculateTargets } from "@/lib/nutrition-targets";
import dynamic from "next/dynamic";

export const dynamic_config = "force-dynamic";
export { dynamic_config as dynamic };

// Skill: nextjs-react-typescript → dynamic loading para componente pesado
const DailyNutrition = dynamic(
  () => import("./daily-nutrition").then((m) => m.DailyNutrition),
  { ssr: false, loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" /> }
);

export default async function NutritionPage() {
  const user = await prisma.user.findUnique({ where: { id: "default-user" } });

  const latestWeight = await prisma.bodyMetric.findFirst({
    where: { userId: "default-user", weightKg: { not: null } },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });

  const weight = latestWeight?.weightKg || 75;
  const targets = calculateTargets(weight, user?.goal || "hypertrophy");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayMeals = await prisma.meal.findMany({
    where: { userId: "default-user", date: { gte: startOfDay, lte: endOfDay } },
    orderBy: { date: "asc" },
  });

  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
      <DailyNutrition meals={todayMeals} targets={targets} />
    </Suspense>
  );
}
```

### [NEW] `src/app/(dashboard)/nutrition/daily-nutrition.tsx` (Client Component)

```typescript
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NutritionTarget } from "@/lib/nutrition-targets";

// Skill: nextjs-react-typescript → interfaces
interface Meal {
  id: string;
  description: string | null;
  photoUrl: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: string;
  verified: boolean;
}

interface DailyNutritionProps {
  meals: Meal[];
  targets: NutritionTarget;
}

// Skill: nextjs-react-typescript → named export, descriptive variables
export function DailyNutrition({ meals, targets }: DailyNutritionProps) {
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.proteinG || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbsG || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fatG || 0), 0);

  const isOverCalories = totalCalories > targets.calories * 1.1;
  const isProteinLow = totalProtein < targets.proteinG * 0.8;
  const hasMeals = meals.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Nutrición</h1>
        <Link href="/nutrition/trends" className="text-sm text-muted-foreground">
          Tendencias →
        </Link>
      </div>

      {/* ANILLOS DE PROGRESO — SVG circles */}
      {/* Anillo grande central: calorías (totalCalories / targets.calories) */}
      {/* 3 mini-anillos: proteína, carbos, grasa */}
      {/* Color: verde ±10%, amarillo <80%, rojo >110% */}

      {/* LISTA DE COMIDAS */}
      {hasMeals ? (
        meals.map((meal) => (
          <Card key={meal.id}>
            <CardContent className="flex items-center gap-3 py-3">
              {meal.photoUrl && (
                <img src={meal.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{meal.description || "Comida"}</p>
                <p className="text-xs text-muted-foreground">
                  {meal.calories || "—"} kcal · {meal.proteinG || "—"}g prot
                </p>
              </div>
              <Badge variant={meal.source === "ai_photo" ? "secondary" : "outline"}>
                {meal.source === "ai_photo" ? "🤖" : "✏️"}
              </Badge>
              {!meal.verified && (
                <Link href={`/nutrition/edit/${meal.id}`}>
                  <Badge variant="destructive">⚠️</Badge>
                </Link>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-3xl">🍽️</p>
          <p className="text-sm mt-2">No has registrado comidas hoy</p>
        </div>
      )}

      {/* BOTONES DE ACCIÓN */}
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="w-full">
          <Link href="/nutrition/add-photo">📸 Foto</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/nutrition/add-manual">✏️ Manual</Link>
        </Button>
      </div>

      {/* MINI-RESUMEN */}
      {isProteinLow && (
        <p className="text-xs text-orange-500">
          ⚠️ Faltan {Math.round(targets.proteinG - totalProtein)}g de proteína
        </p>
      )}
    </div>
  );
}
```

---

## Paso 5: Captura de Foto

### [NEW] `src/app/(dashboard)/nutrition/add-photo/page.tsx` (Client Component)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Skill: nextjs-react-typescript → descriptive variables
export default function AddPhotoPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [hasError, setHasError] = useState(false);

  // Skill: nextjs-react-typescript → function keyword
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
  }

  async function analyzePhoto() {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setHasError(false);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/nutrition/analyze", { method: "POST", body: formData });
      const data = await res.json();
      setAnalysisResult(data.analysis || data);
      // Si la IA devolvió macros, mostrarlos editables
    } catch {
      setHasError(true);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function confirmMeal() {
    // PUT /api/nutrition/meals/[id] con verified=true y macros editados
    router.push("/nutrition");
  }

  return (
    // 1. Input type="file" accept="image/*" capture="environment"
    // 2. Preview con previewUrl
    // 3. Botón "Analizar con IA" → analyzePhoto()
    // 4. Loading spinner si isAnalyzing
    // 5. Cards editables con macros + badge confianza
    // 6. Botón "Confirmar" → confirmMeal()
  );
}
```

---

## Paso 6: Registro Manual

### [NEW] `src/app/(dashboard)/nutrition/add-manual/page.tsx` (Client Component)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Skill: nextjs-react-typescript → map en lugar de enum
const QUICK_MEALS: Record<string, { label: string; proteinG: number; fatG: number; carbsG: number; calories: number }> = {
  chicken: { label: "🍗 Pollo (150g)", proteinG: 46, fatG: 5, carbsG: 0, calories: 231 },
  rice: { label: "🍚 Arroz (200g)", proteinG: 5, fatG: 0.5, carbsG: 56, calories: 260 },
  eggs: { label: "🥚 Huevos ×3", proteinG: 18, fatG: 15, carbsG: 1.5, calories: 210 },
  whey: { label: "🥤 Whey (30g)", proteinG: 24, fatG: 1, carbsG: 3, calories: 120 },
  avocado: { label: "🥑 Aguacate (100g)", proteinG: 2, fatG: 15, carbsG: 9, calories: 160 },
  banana: { label: "🍌 Plátano", proteinG: 1, fatG: 0, carbsG: 27, calories: 105 },
};

export default function AddManualPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Skill: pwa-development → offline detection
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  function applyQuickMeal(key: string) {
    // Rellenar los inputs con los valores del quick meal
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    // POST /api/nutrition/meals
    // Redirect a /nutrition
    router.push("/nutrition");
  }

  return (
    // Formulario:
    // - Quick meal buttons (grid 3×2) → applyQuickMeal(key)
    // - Descripción (text, required)
    // - Calorías, Proteínas, Carbos, Grasas, Fibra → inputMode="decimal"
    // - Notas opcionales
    // - Banner offline si isOffline
    // - Botón Guardar deshabilitado si isSubmitting
  );
}
```

---

## Paso 7: Tendencias Semanales

### [NEW] `src/app/(dashboard)/nutrition/trends/page.tsx` (Server Component)

```typescript
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { calculateTargets } from "@/lib/nutrition-targets";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic_config = "force-dynamic";
export { dynamic_config as dynamic };

// Skill: nextjs-react-typescript → dynamic loading para gráficas
const MacroTrendChart = dynamic(
  () => import("@/components/charts/macro-trend-chart").then((m) => m.MacroTrendChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> }
);

export default async function NutritionTrendsPage() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const meals = await prisma.meal.findMany({
    where: { userId: "default-user", date: { gte: fourWeeksAgo } },
    orderBy: { date: "asc" },
  });

  const user = await prisma.user.findUnique({ where: { id: "default-user" } });
  const latestWeight = await prisma.bodyMetric.findFirst({
    where: { userId: "default-user", weightKg: { not: null } },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });
  const targets = calculateTargets(latestWeight?.weightKg || 75, user?.goal || "hypertrophy");

  // Agrupar por día → { date, protein, carbs, fat, calories }
  // Agrupar por semana → { week, avgCalories, avgProtein, adherence% }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Tendencias Nutricionales</h1>

      <Suspense fallback={<div className="h-[300px] animate-pulse bg-muted rounded-lg" />}>
        <MacroTrendChart data={dailyData} calorieTarget={targets.calories} />
      </Suspense>

      {/* Tabla resumen semanal */}
      {/* Card de insights: proteína promedio, adherencia, patrones */}
    </div>
  );
}
```

### [NEW] `src/components/charts/macro-trend-chart.tsx` (Client Component)

```typescript
"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// Skill: nextjs-react-typescript → interface, named export
interface MacroTrendChartProps {
  data: { date: string; protein: number; carbs: number; fat: number; calories: number }[];
  calorieTarget: number;
}

export function MacroTrendChart({ data, calorieTarget }: MacroTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="protein" name="Proteína" stackId="macros" fill="#22c55e" />
        <Bar dataKey="carbs" name="Carbos" stackId="macros" fill="#3b82f6" />
        <Bar dataKey="fat" name="Grasa" stackId="macros" fill="#eab308" />
        <ReferenceLine y={calorieTarget} stroke="#ef4444" strokeDasharray="5 5" label="Objetivo" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## Paso 8: Navegación

### [MODIFY] `src/app/(dashboard)/page.tsx` (Home)
Añadir quick action card para nutrición:
```tsx
<Link href="/nutrition">
  <Card className="cursor-pointer hover:bg-accent transition-colors">
    <CardContent className="pt-6 text-center">
      <span className="text-3xl">🍽️</span>
      <p className="text-sm font-medium mt-2">Nutrición</p>
    </CardContent>
  </Card>
</Link>
```

### [MODIFY] `src/app/(dashboard)/profile/page.tsx`
Añadir enlace a `/nutrition` desde el perfil.

### [MODIFY] `docs/ROADMAP.md`
Marcar Fase 6: `[x]` en todos los items.

---

## Resumen de archivos

| Acción | Archivo | Tipo | Skill aplicada |
|--------|---------|------|----------------|
| NEW | `src/lib/nutrition-targets.ts` | Utility | Maps, function keyword, interfaces |
| NEW | `src/app/api/nutrition/analyze/route.ts` | API (Vision) | GPT JSON mode |
| NEW | `src/app/api/nutrition/meals/route.ts` | API (CRUD) | Zod validation |
| NEW | `src/app/api/nutrition/meals/[id]/route.ts` | API (PUT/DEL) | — |
| NEW | `src/app/(dashboard)/nutrition/page.tsx` | Server Component | Suspense, dynamic loading |
| NEW | `src/app/(dashboard)/nutrition/daily-nutrition.tsx` | Client Component | Named export, descriptive vars |
| NEW | `src/app/(dashboard)/nutrition/add-photo/page.tsx` | Client Component | function keyword |
| NEW | `src/app/(dashboard)/nutrition/add-manual/page.tsx` | Client Component | Maps, offline detection |
| NEW | `src/app/(dashboard)/nutrition/trends/page.tsx` | Server Component | Suspense, dynamic loading |
| NEW | `src/components/charts/macro-trend-chart.tsx` | Client Component | Named export, interfaces |
| MODIFY | `src/app/(dashboard)/page.tsx` | — | Quick action |
| MODIFY | `src/app/(dashboard)/profile/page.tsx` | — | Enlace |
| MODIFY | `docs/ROADMAP.md` | Docs | — |

---

## Verificación

1. `npx next build` compila sin errores
2. Con PostgreSQL y `OPENAI_API_KEY`:
   - `/nutrition` muestra anillos de progreso y lista vacía
   - `/nutrition/add-photo` → cámara → analiza → muestra macros editables
   - `/nutrition/add-manual` → quick meals rellenan campos → guardar
   - `/nutrition/trends` → gráfica BarChart con ReferenceLine
3. Sin API key → foto se sube pero análisis falla con error amigable (se puede añadir macros manualmente)
4. Quick meals rellenan campos automáticamente
5. `inputMode="decimal"` muestra teclado numérico en iPhone
6. Gráficas cargan con skeleton fallback (Suspense + dynamic)
7. Responsive 390px
