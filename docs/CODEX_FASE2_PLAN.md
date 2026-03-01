# Plan de Implementación — Fase 2: Historial y Métricas

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Contexto del Proyecto

### Stack actual
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI:** Shadcn UI (componentes en `src/components/ui/`)
- **ORM:** Prisma 6 con PostgreSQL (schema en `prisma/schema.prisma`)
- **Estructura:** Route group `(dashboard)` con BottomNav de 5 tabs
- **Skills:** `.agents/skills/` — `nextjs-react-typescript`, `pwa-development`, `git-workflow`, `writing-documentation-with-diataxis`

### Archivos clave existentes
| Archivo | Propósito |
|---------|-----------|
| `src/lib/prisma.ts` | Singleton de Prisma Client |
| `src/lib/utils.ts` | Helper `cn()` para clases |
| `src/app/(dashboard)/layout.tsx` | Layout con BottomNav |
| `src/app/(dashboard)/progress/page.tsx` | **Placeholder actual** — REEMPLAZAR |
| `src/app/api/workouts/route.ts` | API GET/POST de sesiones |
| `prisma/schema.prisma` | Schema con 12 modelos (Session, WorkoutSet, Exercise...) |
| `prisma/seed.ts` | 27 ejercicios + usuario por defecto |

### Modelos relevantes del schema
```prisma
model Session {
  id, userId, routineId?, date, durationMin?, notes?, energyLevel?, overallRPE?, status, createdAt
  workoutSets WorkoutSet[]
}

model WorkoutSet {
  id, sessionId, exerciseId, setNumber, reps, weight, rir?, rpe?, restSeconds?, isEffective, notes?, completedAt?
  exercise Exercise
}

model Exercise {
  id, name, primaryMuscle, secondaryMuscles, pattern, equipment, difficulty
  minRepRange, maxRepRange, recommendedRIR
}
```

---

## Skills a consultar ANTES de codificar

1. **Lee** `.agents/skills/nextjs-react-typescript/SKILL.md` — Aplica:
   - Server Components para data fetching (Prisma queries)
   - `'use client'` SOLO para gráficas interactivas y filtros
   - Interfaces, no types ni enums
   - Named exports, directorios en kebab-case
   - Mobile-first con Tailwind

2. **Lee** `.agents/skills/git-workflow/SKILL.md` — Aplica:
   - Conventional Commits en **primera persona** (como si el usuario lo hiciera)
   - Commits atómicos
   - Crear branch `feature/history-metrics` desde `develop`

---

## Git: Branch y commits

```bash
# ANTES de empezar
git checkout develop
git pull origin develop
git checkout -b feature/history-metrics

# Autor (ya configurado)
# user.name = JaimeLaraC
# user.email = jaimelara@users.noreply.github.com
```

### Commits a hacer (en orden):
1. `feat(charts): instalo Recharts y creo componentes de gráficas base`
2. `feat(history): implemento historial de sesiones con filtros y detalle`
3. `feat(metrics): implemento e1RM, PRs automáticos y volumen semanal`
4. `feat(progress): integro página de progreso con todas las métricas`
5. `docs(roadmap): marco la Fase 2 como completada`

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/history-metrics -m "merge: integro historial y métricas en develop"
git push origin feature/history-metrics
git push origin develop
```

---

## Paso 1: Instalar Recharts

```bash
npm install recharts
```

---

## Paso 2: Crear funciones de cálculo (utility layer)

### [NEW] `src/lib/calculations.ts`

Funciones puras, sin dependencias de React ni Prisma:

```typescript
// e1RM (Fórmula de Brzycki)
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}

// Volumen total
export function calculateVolume(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

// Series efectivas (RIR <= 3)
export function countEffectiveSets(sets: { rir: number | null }[]): number {
  return sets.filter((s) => s.rir !== null && s.rir <= 3).length;
}

// Detectar PR
export interface PR {
  type: "weight" | "reps" | "e1rm" | "volume";
  value: number;
  previousBest: number;
  exerciseName: string;
  date: Date;
}

export function detectPRs(
  currentSets: { weight: number; reps: number; rir: number | null }[],
  historicalSets: { weight: number; reps: number }[],
  exerciseName: string,
  date: Date
): PR[] { /* ... implementar ... */ }
```

---

## Paso 3: Crear componentes de gráficas reutilizables

### [NEW] `src/components/charts/volume-chart.tsx`

Componente `'use client'` que renderiza volumen semanal por músculo usando Recharts `BarChart`.

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface VolumeChartProps {
  data: { muscle: string; sets: number; label: string }[];
}

export function VolumeChart({ data }: VolumeChartProps) {
  // BarChart horizontal con barra por músculo
  // Colores: primary para sets efectivos
  // Responsive: width 100%, height 300
}
```

### [NEW] `src/components/charts/e1rm-chart.tsx`

`LineChart` que muestra la progresión del e1RM estimado a lo largo del tiempo.

```typescript
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface E1RMChartProps {
  data: { date: string; e1rm: number }[];
  exerciseName: string;
}

export function E1RMChart({ data, exerciseName }: E1RMChartProps) {
  // LineChart con línea suavizada (type="monotone")
  // XAxis: fecha formateada (día/mes)
  // YAxis: peso en kg
  // Tooltip con fecha y peso
}
```

### [NEW] `src/components/charts/weekly-volume-chart.tsx`

`BarChart` apilado que muestra el volumen total por semana.

```typescript
"use client";

interface WeeklyVolumeChartProps {
  data: { week: string; volume: number; effectiveSets: number; totalSets: number }[];
}
```

---

## Paso 4: Historial de sesiones

### [NEW] `src/app/(dashboard)/train/history/page.tsx` (Server Component)

```typescript
import { prisma } from "@/lib/prisma";
import { SessionHistory } from "./session-history";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const sessions = await prisma.session.findMany({
    where: { userId: "default-user", status: "completed" },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      workoutSets: { include: { exercise: true } },
      routine: true,
    },
  });
  return <SessionHistory sessions={sessions} />;
}
```

### [NEW] `src/app/(dashboard)/train/history/session-history.tsx` (Client Component)

Lista de sesiones pasadas con:
- Fecha, duración, número de series
- Filtro por fecha (últimos 7, 30, 90 días)
- Cada card clickable → detalle

### [NEW] `src/app/(dashboard)/train/history/[id]/page.tsx` (Server Component)

Detalle de una sesión:
- Fecha, duración, RPE
- Lista de ejercicios con todas sus series (peso × reps @ RIR)
- Volumen total de la sesión
- Series efectivas vs totales
- PRs batidos en esa sesión (badge 🏆)

---

## Paso 5: Historial por ejercicio

### [NEW] `src/app/(dashboard)/train/exercises/[id]/page.tsx` (Server Component)

```typescript
export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  
  const sets = await prisma.workoutSet.findMany({
    where: { exerciseId: id },
    orderBy: { completedAt: "desc" },
    include: { session: true },
  });

  // Calcular:
  // - e1RM actual y máximo histórico
  // - Progresión de e1RM (para E1RMChart)
  // - PRs (peso max, reps max, mejor e1RM)
  // - Últimas 5 sesiones con este ejercicio

  return (
    // Usar E1RMChart para mostrar progresión
    // Tabla con últimas sesiones
    // Cards con PRs
  );
}
```

---

## Paso 6: Página de Progreso (reemplazar placeholder)

### [MODIFY] `src/app/(dashboard)/progress/page.tsx`

Reemplazar el placeholder actual con:

```typescript
import { prisma } from "@/lib/prisma";
import { VolumeChart } from "@/components/charts/volume-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  // 1. Obtener sesiones de las últimas 8 semanas
  // 2. Calcular volumen semanal por músculo
  // 3. Calcular PRs recientes
  // 4. Calcular tendencia de series efectivas

  return (
    <div className="space-y-6">
      <h1>Progreso</h1>
      
      <Tabs defaultValue="volume">
        <TabsList>
          <TabsTrigger value="volume">Volumen</TabsTrigger>
          <TabsTrigger value="prs">PRs</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>
        
        <TabsContent value="volume">
          {/* VolumeChart: series por músculo esta semana */}
          {/* WeeklyVolumeChart: volumen total últimas 8 semanas */}
        </TabsContent>
        
        <TabsContent value="prs">
          {/* Lista de PRs recientes con badge 🏆 */}
          {/* Top 5 ejercicios por e1RM */}
        </TabsContent>
        
        <TabsContent value="trends">
          {/* Frecuencia de entrenamiento (sesiones/semana) */}
          {/* Volumen total semanal (tendencia) */}
          {/* Series efectivas / totales (ratio) */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Paso 7: Actualizar la home con datos reales

### [MODIFY] `src/app/(dashboard)/page.tsx`

Conectar los placeholders del dashboard con datos de Prisma:
- Score: mostrar "—" si no hay datos (ya está)
- Resumen semanal: query de sesiones de esta semana → series, sesiones, volumen real
- Próxima sesión: si hay rutinas, mostrar la siguiente

Añadir `export const dynamic = "force-dynamic"` y hacer queries:

```typescript
const thisWeekStart = new Date();
thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

const weeklySessions = await prisma.session.findMany({
  where: {
    userId: "default-user",
    date: { gte: thisWeekStart },
    status: "completed",
  },
  include: { workoutSets: true },
});

const weeklyStats = {
  sessions: weeklySessions.length,
  totalSets: weeklySessions.reduce((s, ses) => s + ses.workoutSets.length, 0),
  totalVolume: weeklySessions.reduce(
    (v, ses) => v + ses.workoutSets.reduce((sv, set) => sv + set.weight * set.reps, 0), 0
  ),
};
```

---

## Resumen de archivos

| Acción | Archivo | Tipo |
|--------|---------|------|
| NEW | `src/lib/calculations.ts` | Utility |
| NEW | `src/components/charts/volume-chart.tsx` | Client Component |
| NEW | `src/components/charts/e1rm-chart.tsx` | Client Component |
| NEW | `src/components/charts/weekly-volume-chart.tsx` | Client Component |
| NEW | `src/app/(dashboard)/train/history/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/train/history/session-history.tsx` | Client Component |
| NEW | `src/app/(dashboard)/train/history/[id]/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/train/exercises/[id]/page.tsx` | Server Component |
| MODIFY | `src/app/(dashboard)/progress/page.tsx` | Server Component |
| MODIFY | `src/app/(dashboard)/page.tsx` | Server Component |
| MODIFY | `docs/ROADMAP.md` | Docs |

---

## Verificación

1. `npx next build` compila sin errores
2. Con PostgreSQL corriendo y seed ejecutado:
   - `/train/history` muestra sesiones pasadas
   - `/train/history/[id]` muestra detalle con series
   - `/train/exercises/[id]` muestra e1RM y gráfica de progresión
   - `/progress` muestra gráficas de volumen y PRs
   - `/` (home) muestra resumen semanal real
3. Las gráficas de Recharts renderizan correctamente en móvil (390px)

---

## Reglas importantes

- **Commits en primera persona** → `feat(history): implemento el historial de sesiones con filtros`
- **Server Components** para queries de Prisma. `'use client'` SOLO para:
  - Gráficas de Recharts
  - Filtros interactivos (useState)
- **Usar `cn()`** de `@/lib/utils` para clases condicionales
- **force-dynamic** en todas las páginas que hagan queries a Prisma
- **Mobile-first** — Diseñar para 390px de ancho
- **Dark mode** — Los colores de Shadcn ya soportan dark mode
- **No crear tests** en esta fase (se harán en Fase 8)
