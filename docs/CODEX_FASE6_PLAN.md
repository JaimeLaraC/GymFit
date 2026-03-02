# Plan de Implementación — Fase 6: Nutrición

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Contexto del Proyecto

### Stack actual
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI:** Shadcn UI (`src/components/ui/`)
- **ORM:** Prisma 6 con PostgreSQL
- **IA:** OpenAI SDK (`src/lib/openai.ts`) — reutilizaremos para GPT Vision
- **Gráficas:** Recharts (`src/components/charts/`)
- **Skills:** `.agents/skills/` — `nextjs-react-typescript`, `git-workflow`

### Modelo Prisma YA existente (NO modificar schema)

```prisma
model Meal {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime
  photoUrl    String?
  description String?
  calories    Float?
  proteinG    Float?
  carbsG      Float?
  fatG        Float?
  fiberG      Float?
  source      String   @default("manual") // ai_photo | manual
  verified    Boolean  @default(false)
  notes       String?
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, date])
}
```

### User model (campo goal relevante)
```prisma
model User {
  goal String @default("hypertrophy") // hypertrophy | strength | recomposition | definition
}
```

---

## Skills a consultar ANTES de codificar

1. **Lee** `.agents/skills/nextjs-react-typescript/SKILL.md` — Server Components, Route Handlers, formularios
2. **Lee** `.agents/skills/git-workflow/SKILL.md` — Conventional Commits en primera persona

---

## Git: Branch y commits

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nutrition
```

### Commits a hacer (en orden):
1. `feat(nutrition): implemento análisis de foto de comida con GPT Vision`
2. `feat(nutrition): implemento registro manual de comidas y API REST`
3. `feat(nutrition): implemento seguimiento diario de calorías y macros`
4. `feat(nutrition): implemento objetivos nutricionales por fase`
5. `feat(nutrition): implemento tendencias semanales con gráficas`
6. `docs(roadmap): marco la Fase 6 como completada`

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/nutrition -m "merge: integro módulo de nutrición en develop"
git push origin feature/nutrition
git push origin develop
```

---

## Paso 1: API de Análisis de Foto con GPT Vision

### [NEW] `src/app/api/nutrition/analyze/route.ts`

Endpoint que recibe una foto de comida y devuelve los macros estimados:

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

  // 1. Guardar la imagen
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${randomUUID()}.${file.name.split(".").pop()}`;
  const dir = join(process.cwd(), "public", "uploads", "meals");
  await mkdir(dir, { recursive: true });
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);
  const photoUrl = `/uploads/meals/${filename}`;

  // 2. Convertir a base64 para GPT Vision
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";

  // 3. Analizar con GPT Vision
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content: `Eres un nutricionista experto. Analiza la foto de comida y estima los valores nutricionales.
Responde SOLO en JSON con este formato exacto:
{
  "description": "descripción breve del plato en español",
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "confidence": "high" | "medium" | "low",
  "notes": "notas adicionales si las hay"
}
Sé conservador en las estimaciones. Si no puedes identificar con certeza el alimento, indica confidence: "low".`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analiza esta comida:" },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  // 4. Parsear respuesta
  try {
    const analysis = JSON.parse(response.choices[0].message.content || "{}");

    // 5. Crear registro en Meal
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
        notes: analysis.notes || null,
      },
    });

    return NextResponse.json({ meal, analysis }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al analizar la imagen" }, { status: 500 });
  }
}
```

---

## Paso 2: API CRUD de Comidas

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

// POST: Registrar comida manualmente
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = mealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meal = await prisma.meal.create({
    data: {
      ...parsed.data,
      date: new Date(),
      source: "manual",
      verified: true, // manual = ya verificada
    },
  });

  return NextResponse.json(meal, { status: 201 });
}

// GET: Comidas del día o de un rango
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const date = searchParams.get("date"); // YYYY-MM-DD opcional

  const startOfDay = date ? new Date(date) : new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { date: "asc" },
  });

  // Calcular totales del día
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
// PUT: Actualizar comida (verificar/corregir macros post-análisis IA)
// Cuerpo: { calories?, proteinG?, carbsG?, fatG?, fiberG?, description?, verified: true }
// Marcar verified = true cuando el usuario corrige los macros

// DELETE: Eliminar comida
```

---

## Paso 3: Objetivos Nutricionales

### [NEW] `src/lib/nutrition-targets.ts`

Calcula los objetivos diarios según la fase del usuario:

```typescript
export interface NutritionTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  label: string;
}

// Calcular objetivos basados en el goal del usuario y su peso
export function calculateTargets(
  weightKg: number,
  goal: string // hypertrophy | strength | recomposition | definition
): NutritionTarget {
  // Proteína: siempre 1.8-2.2g/kg
  const proteinPerKg = 2.0;
  const proteinG = Math.round(weightKg * proteinPerKg);

  switch (goal) {
    case "hypertrophy":
      // Superávit calórico: ~35 kcal/kg
      return {
        calories: Math.round(weightKg * 35),
        proteinG,
        carbsG: Math.round(weightKg * 4.5),   // Carbos altos
        fatG: Math.round(weightKg * 1.0),
        fiberG: 30,
        label: "Volumen (superávit)",
      };
    case "definition":
      // Déficit calórico: ~25 kcal/kg
      return {
        calories: Math.round(weightKg * 25),
        proteinG: Math.round(weightKg * 2.2),  // Proteína más alta en déficit
        carbsG: Math.round(weightKg * 2.5),
        fatG: Math.round(weightKg * 0.8),
        fiberG: 35,
        label: "Definición (déficit)",
      };
    case "recomposition":
      // Mantenimiento: ~30 kcal/kg
      return {
        calories: Math.round(weightKg * 30),
        proteinG: Math.round(weightKg * 2.2),
        carbsG: Math.round(weightKg * 3.5),
        fatG: Math.round(weightKg * 0.9),
        fiberG: 30,
        label: "Recomposición (mantenimiento)",
      };
    case "strength":
    default:
      // Ligero superávit: ~32 kcal/kg
      return {
        calories: Math.round(weightKg * 32),
        proteinG,
        carbsG: Math.round(weightKg * 4.0),
        fatG: Math.round(weightKg * 0.9),
        fiberG: 30,
        label: "Fuerza (ligero superávit)",
      };
  }
}
```

---

## Paso 4: Página Principal de Nutrición

La sección de nutrición no tiene tab propio en el BottomNav. Se accede desde el perfil o desde quick actions. Usar la ruta `/nutrition` dentro del dashboard.

### [NEW] `src/app/(dashboard)/nutrition/page.tsx` (Server Component)

```typescript
import { prisma } from "@/lib/prisma";
import { calculateTargets } from "@/lib/nutrition-targets";
import { DailyNutrition } from "./daily-nutrition";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const user = await prisma.user.findUnique({ where: { id: "default-user" } });
  
  // Obtener último peso registrado
  const latestWeight = await prisma.bodyMetric.findFirst({
    where: { userId: "default-user", weightKg: { not: null } },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });

  const weight = latestWeight?.weightKg || 75; // fallback 75kg
  const targets = calculateTargets(weight, user?.goal || "hypertrophy");

  // Comidas de hoy
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayMeals = await prisma.meal.findMany({
    where: {
      userId: "default-user",
      date: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { date: "asc" },
  });

  return <DailyNutrition meals={todayMeals} targets={targets} />;
}
```

### [NEW] `src/app/(dashboard)/nutrition/daily-nutrition.tsx` (Client Component)

`'use client'` — Vista diaria con:

```typescript
// Componente principal del día nutricional:
//
// 1. ANILLOS DE PROGRESO (tipo Apple Watch rings):
//    - Calorías: anillo grande central con número
//    - Proteína / Carbos / Grasa: 3 mini-anillos abajo
//    - Colores: verde si ±10% del objetivo, amarillo si déficit, rojo si exceso
//
// 2. LISTA DE COMIDAS del día:
//    - Foto thumbnail (si hay) + descripción
//    - Macros por comida
//    - Badge 🤖 si fue analizada por IA, ✏️ si fue manual
//    - Badge ⚠️ si no verificada (clickable → editar)
//
// 3. BOTONES DE ACCIÓN:
//    - "📸 Foto" → navega a /nutrition/add-photo
//    - "✏️ Manual" → navega a /nutrition/add-manual
//
// 4. MINI-RESUMEN abajo:
//    - "Faltan Xg de proteína para tu objetivo"
//    - "Has consumido X% de tus calorías"
```

---

## Paso 5: Captura de Foto de Comida

### [NEW] `src/app/(dashboard)/nutrition/add-photo/page.tsx` (Client Component)

```typescript
"use client";

// Flujo:
// 1. Input type="file" accept="image/*" capture="environment"
//    (abre cámara en iPhone)
// 2. Preview de la imagen
// 3. Botón "Analizar con IA" → POST /api/nutrition/analyze (FormData)
// 4. Loading spinner durante el análisis
// 5. Mostrar resultado:
//    - Descripción del plato
//    - Macros estimados (editables en inputs)
//    - Confianza del análisis (badge high/medium/low)
// 6. Botón "Confirmar" → PUT /api/nutrition/meals/[id] con verified=true
//    (si el usuario editó los macros, se actualizan)
// 7. Botón "Rechazar y registrar manualmente" → /nutrition/add-manual
// 8. Redirect a /nutrition tras confirmar
```

---

## Paso 6: Registro Manual de Comida

### [NEW] `src/app/(dashboard)/nutrition/add-manual/page.tsx` (Client Component)

```typescript
"use client";

// Formulario con:
// - Descripción (text, requerido) — ej: "Pollo con arroz y ensalada"
// - Calorías (number, opcional si no sabe)
// - Proteínas (g)
// - Carbohidratos (g)
// - Grasas (g)
// - Fibra (g)
// - Notas opcionales
//
// Acciones rápidas con comidas frecuentes (hardcoded para v1):
// const quickMeals = [
//   { label: "🍗 Pollo (150g)", proteinG: 46, fatG: 5, carbsG: 0, calories: 231 },
//   { label: "🍚 Arroz (200g)", proteinG: 5, fatG: 0.5, carbsG: 56, calories: 260 },
//   { label: "🥚 Huevos x3", proteinG: 18, fatG: 15, carbsG: 1.5, calories: 210 },
//   { label: "🥤 Whey (30g)", proteinG: 24, fatG: 1, carbsG: 3, calories: 120 },
//   { label: "🥑 Aguacate (100g)", proteinG: 2, fatG: 15, carbsG: 9, calories: 160 },
//   { label: "🍌 Plátano", proteinG: 1, fatG: 0, carbsG: 27, calories: 105 },
// ];
//
// Al clickar un acceso rápido → rellena los campos automáticamente
//
// Botón Guardar → POST /api/nutrition/meals
// Redirect a /nutrition
//
// Inputs: inputMode="decimal" para teclado numérico en iPhone
```

---

## Paso 7: Tendencias Semanales

### [NEW] `src/app/(dashboard)/nutrition/trends/page.tsx` (Server Component)

```typescript
export const dynamic = "force-dynamic";

export default async function NutritionTrendsPage() {
  // Cargar comidas de las últimas 4 semanas
  // Agrupar por día → calcular totales diarios
  // Agrupar por semana → calcular promedios semanales

  return (
    // Gráfica MacroTrendChart:
    //   - BarChart apilado por día (proteína, carbos, grasa)
    //   - Línea de calorías encima
    //   - ReferenceLine en el objetivo calórico
    //
    // Tabla resumen semanal:
    //   | Semana | Cal/día | Prot/día | Adherencia |
    //
    // Card de insights:
    //   - "Tu proteína promedio es Xg/día (objetivo: Yg)"
    //   - "Llevas X días cumpliendo el objetivo calórico"
    //   - "Los fines de semana consumes un X% más de calorías"
  );
}
```

### [NEW] `src/components/charts/macro-trend-chart.tsx` (Client Component)

`'use client'` — BarChart apilado:

```typescript
"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from "recharts";

interface MacroTrendChartProps {
  data: {
    date: string;
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  }[];
  calorieTarget: number;
}

export function MacroTrendChart({ data, calorieTarget }: MacroTrendChartProps) {
  // Bars apiladas: protein (verde), carbs (azul), fat (amarillo)
  // ReferenceLine en calorieTarget
  // Tooltip con desglose
  // Height: 300px
}
```

---

## Paso 8: Navegación a Nutrición

### [MODIFY] `src/app/(dashboard)/page.tsx` (Home)

Añadir una quick action card para nutrición:
```typescript
// En la sección de quick actions:
<Link href="/nutrition">
  <Card>
    <CardContent>🍽️ Nutrición</CardContent>
  </Card>
</Link>
```

### [MODIFY] `src/app/(dashboard)/profile/page.tsx`

Añadir enlace a nutrición desde el perfil (ya que no tiene tab propio).

### [MODIFY] `.gitignore`

Verificar que `public/uploads/` sigue ignorado (ya añadido en Fase 3 para fotos de progreso, las fotos de comida van a `public/uploads/meals/`).

### [MODIFY] `docs/ROADMAP.md`

Marcar Fase 6 como completada con `[x]`.

---

## Resumen de archivos

| Acción | Archivo | Tipo |
|--------|---------|------|
| NEW | `src/app/api/nutrition/analyze/route.ts` | API (GPT Vision) |
| NEW | `src/app/api/nutrition/meals/route.ts` | API (CRUD) |
| NEW | `src/app/api/nutrition/meals/[id]/route.ts` | API (PUT/DELETE) |
| NEW | `src/lib/nutrition-targets.ts` | Utility |
| NEW | `src/app/(dashboard)/nutrition/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/nutrition/daily-nutrition.tsx` | Client Component |
| NEW | `src/app/(dashboard)/nutrition/add-photo/page.tsx` | Client Component |
| NEW | `src/app/(dashboard)/nutrition/add-manual/page.tsx` | Client Component |
| NEW | `src/app/(dashboard)/nutrition/trends/page.tsx` | Server Component |
| NEW | `src/components/charts/macro-trend-chart.tsx` | Client Component |
| MODIFY | `src/app/(dashboard)/page.tsx` | Añadir quick action |
| MODIFY | `src/app/(dashboard)/profile/page.tsx` | Añadir enlace |
| MODIFY | `.gitignore` | Verificar uploads |
| MODIFY | `docs/ROADMAP.md` | Docs |

**Total: 10 archivos nuevos + 4 modificados**

---

## Verificación

1. `npx next build` compila sin errores
2. Con PostgreSQL y `OPENAI_API_KEY` configurada:
   - `/nutrition` muestra resumen diario con anillos de progreso
   - `/nutrition/add-photo` abre cámara, sube foto, GPT analiza y muestra macros
   - El usuario puede corregir macros y confirmar
   - `/nutrition/add-manual` permite registrar comida con accesos rápidos
   - `/nutrition/trends` muestra gráficas de las últimas 4 semanas
   - Los objetivos cambian según el `goal` del usuario
3. Sin API key → la foto se sube pero el análisis falla con error amigable
4. Quick meals rellenan campos automáticamente
5. Responsive a 390px — anillos de progreso visibles en móvil
6. Fotos se guardan en `public/uploads/meals/`

---

## Reglas importantes

- **Commits en primera persona** → `feat(nutrition): implemento análisis de foto con GPT Vision`
- **Server Components** para queries. `'use client'` SOLO para:
  - Formularios (add-photo, add-manual)
  - Daily nutrition (interacción con comidas)
  - Gráficas Recharts
- **`force-dynamic`** en páginas con queries
- **GPT Vision** usa `response_format: { type: "json_object" }` para output estructurado
- **Validación Zod** en el registro manual
- **inputMode="decimal"** en inputs de macros para teclado numérico
- **NO crear tests** en esta fase
- **NO modificar el schema** de Prisma — `Meal` ya existe
- **Accesos rápidos** hardcoded en v1 (se pueden hacer dinámicos en el futuro)
