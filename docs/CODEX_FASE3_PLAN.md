# Plan de Implementación — Fase 3: Score Global, Fotos y Medidas Corporales

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Contexto del Proyecto

### Stack actual
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI:** Shadcn UI (componentes en `src/components/ui/`)
- **ORM:** Prisma 6 con PostgreSQL (schema en `prisma/schema.prisma`)
- **Gráficas:** Recharts (ya instalado — `src/components/charts/`)
- **Cálculos:** `src/lib/calculations.ts` (e1RM, volumen, PRs)
- **Skills:** `.agents/skills/` — `nextjs-react-typescript`, `pwa-development`, `git-workflow`

### Archivos existentes relevantes

| Archivo | Propósito |
|---------|-----------|
| `src/lib/calculations.ts` | `calculateE1RM()`, `calculateVolume()`, `countEffectiveSets()`, `detectPRs()` |
| `src/app/(dashboard)/progress/page.tsx` | Página de progreso con tabs Volumen/PRs/Tendencias (410 líneas) |
| `src/components/charts/volume-chart.tsx` | BarChart de volumen por músculo |
| `src/components/charts/weekly-volume-chart.tsx` | BarChart de volumen semanal |
| `src/components/charts/e1rm-chart.tsx` | LineChart de progresión de e1RM |
| `src/app/(dashboard)/page.tsx` | Dashboard home con resumen semanal |
| `prisma/schema.prisma` | Ya incluye `BodyMetric` y `ProgressPhoto` models |

### Modelos Prisma YA existentes (no modificar el schema)

```prisma
model BodyMetric {
  id, userId, date (Date), weightKg?, chestCm?, waistCm?, hipsCm?,
  leftArmCm?, rightArmCm?, leftThighCm?, rightThighCm?, calfCm?,
  shouldersCm?, notes?, createdAt
  @@index([userId, date])
}

model ProgressPhoto {
  id, userId, date (Date), imageUrl, angle ("front"|"side"|"back"),
  notes?, createdAt
  @@index([userId, date])
}

model RecoverySnapshot {
  id, userId, sessionId? (unique), date (Date), hrvMs?, restingHrBpm?,
  sleepHours?, steps?, activeEnergyKcal?, spo2?, bodyTemperature?,
  respiratoryRate?, subjectiveEnergy? (1-10), stressLevel? (1-10),
  source ("shortcut"|"manual"|"xml_import"), createdAt
  @@unique([userId, date])
}
```

---

## Skills a consultar ANTES de codificar

1. **Lee** `.agents/skills/nextjs-react-typescript/SKILL.md` — Aplica:
   - Server Components para data fetching (Prisma queries)
   - `'use client'` SOLO para formularios, gráficas y comparación interactiva
   - Interfaces (no types ni enums)
   - Named exports, directorios en kebab-case
   - Mobile-first con Tailwind
   - Formularios: React 19 `useActionState` o Server Actions preferidos

2. **Lee** `.agents/skills/git-workflow/SKILL.md` — Aplica:
   - Conventional Commits en **primera persona**
   - Commits atómicos por funcionalidad

---

## Git: Branch y commits

```bash
# ANTES de empezar
git checkout develop
git pull origin develop
git checkout -b feature/progress
```

### Commits a hacer (en orden):
1. `feat(score): implemento cálculo del score global 0-100 con desglose`
2. `feat(body): implemento registro y visualización de métricas corporales`
3. `feat(photos): implemento subida de fotos de progreso y comparación`
4. `feat(progress): integro score, métricas y fotos en la página de progreso`
5. `docs(roadmap): marco la Fase 3 como completada`

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/progress -m "merge: integro score global, fotos y medidas corporales en develop"
git push origin feature/progress
git push origin develop
```

---

## Paso 1: Score Global 0-100

### Concepto del Score

El Score Global representa el estado general del usuario combinando **4 dimensiones**:

| Dimensión | Peso | Qué mide | Fuente de datos |
|-----------|------|----------|-----------------|
| Rendimiento | 35% | Progresión de fuerza (e1RM trending up) | `WorkoutSet` |
| Volumen | 25% | Series efectivas semanales vs objetivo | `WorkoutSet` (RIR ≤ 3) |
| Consistencia | 25% | Frecuencia de entreno (sesiones/semana) | `Session` |
| Recuperación | 15% | Datos fisiológicos (si disponibles) | `RecoverySnapshot` |

### [NEW] `src/lib/score.ts`

Funciones puras para calcular el score. Sigue el patrón de `calculations.ts`:

```typescript
// ==================== INTERFACES ====================

export interface ScoreInput {
  // Últimas 4 semanas de datos
  weeklySessions: number[];     // ej: [4, 3, 4, 5] — sesiones/semana
  weeklyEffectiveSets: number[]; // ej: [40, 35, 42, 38]
  targetSetsPerWeek: number;     // ej: 40 (objetivo configurable)
  targetSessionsPerWeek: number; // ej: 4
  
  // e1RM trending: array de mejores e1RM semanales de los top 5 ejercicios
  e1rmTrends: { week: number; avgE1rm: number }[];
  
  // Recovery (opcional)
  latestRecovery: {
    sleepHours: number | null;
    hrvMs: number | null;
    restingHrBpm: number | null;
    subjectiveEnergy: number | null;
  } | null;
}

export interface ScoreResult {
  total: number;          // 0-100
  performance: number;    // 0-100
  volume: number;         // 0-100
  consistency: number;    // 0-100
  recovery: number;       // 0-100
  trend: "up" | "stable" | "down";
}

// ==================== FUNCIONES ====================

export function calculateScore(input: ScoreInput): ScoreResult { /* ... */ }

// Performance (35%): comparar e1RM promedio de esta semana vs hace 4 semanas
// - Subió ≥5%: 100
// - Subió 2-5%: 85
// - Estable (±2%): 70
// - Bajó: 40-60 proporcional

function calculatePerformanceScore(e1rmTrends: ScoreInput["e1rmTrends"]): number { /* ... */ }

// Volume (25%): ratio de sets efectivos vs objetivo
// - ≥100% del objetivo: 100
// - 80-100%: 70-100 proporcional
// - <80%: 30-70 proporcional

function calculateVolumeScore(weeklyEffectiveSets: number[], target: number): number { /* ... */ }

// Consistency (25%): ratio de sesiones vs objetivo
// - ≥100% del objetivo: 100
// - Una sesión menos: 75
// - Dos menos: 50
// - Cero sesiones: 0

function calculateConsistencyScore(weeklySessions: number[], target: number): number { /* ... */ }

// Recovery (15%): si hay datos → normalizar cada métrica y promediar
// - Sueño ≥7h: 100, 6h: 60, <5h: 20
// - HRV: basado en percentil personal
// - FC reposo: <60 excelente, >70 bajo
// - Energía subjetiva: directa (×10)
// Si no hay datos de recovery → usar 70 (neutral)

function calculateRecoveryScore(recovery: ScoreInput["latestRecovery"]): number { /* ... */ }

// Trend: comparar score de esta semana vs promedio de las 3 anteriores
function calculateTrend(weeklyScores: number[]): "up" | "stable" | "down" { /* ... */ }
```

### [NEW] `src/components/score-card.tsx`

Componente **Server Component** (no necesita 'use client') que muestra:
- Score grande (número 0-100) con color según valor:
  - ≥80: `text-green-500` (excelente)
  - 60-79: `text-yellow-500` (bien)
  - 40-59: `text-orange-500` (mejorable)
  - <40: `text-red-500` (bajo)
- Flecha de tendencia (↑ ↓ →)
- 4 barras de desglose (rendimiento, volumen, consistencia, recuperación)
- Usar `Card` de Shadcn UI

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ScoreCardProps {
  score: {
    total: number;
    performance: number;
    volume: number;
    consistency: number;
    recovery: number;
    trend: "up" | "stable" | "down";
  };
}

export function ScoreCard({ score }: ScoreCardProps) {
  // Renderizar el score con barras de progreso para cada dimensión
  // Usar divs con width porcentual para las barras (no necesitas librería)
  // El trend se muestra con emoji: ↑ ↗ → ↘ ↓
}
```

### [NEW] `src/components/charts/score-trend-chart.tsx`

`'use client'` — LineChart de Recharts mostrando el score total de las últimas 4-8 semanas.

```typescript
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ScoreTrendChartProps {
  data: { week: string; score: number }[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  // LineChart con línea suavizada
  // ReferenceLine en y=70 (objetivo mínimo)
  // Colores: verde >80, amarillo 60-80, rojo <60
  // Height: 200px
}
```

---

## Paso 2: Métricas Corporales (BodyMetric)

### [NEW] `src/app/api/body-metrics/route.ts`

API REST para métricas corporales:

```typescript
// POST: Crear nueva medición
// Body: { userId, weightKg?, chestCm?, waistCm?, ... }
// Valida que al menos un campo numérico exista
// Usa upsert con unique constraint [userId, date] para evitar duplicados el mismo día

// GET: Obtener historial
// Query params: userId, limit (default 30)
// Ordenar por date DESC
```

### [NEW] `src/app/(dashboard)/progress/body/page.tsx` (Server Component)

Página de métricas corporales:

```typescript
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BodyMetricsPage() {
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: "default-user" },
    orderBy: { date: "desc" },
    take: 90,
  });

  // Calcular:
  // 1. Peso actual y peso suavizado (EMA)
  // 2. Diferencia vs hace 4 semanas
  // 3. Últimas medidas vs anteriores (deltas)
  
  return (
    // Header con botón "Añadir medición"
    // Card con peso actual vs suavizado
    // Gráfica de peso (WeightChart)
    // Tabla de medidas actuales con deltas
    // Lista de mediciones pasadas
  );
}
```

### [NEW] `src/app/(dashboard)/progress/body/add/page.tsx` (Client Component)

Formulario para registrar nueva medición:

```typescript
"use client";

// Formulario con inputs para:
// - Peso (kg) — el más importante, campo grande
// - Expandible "Medidas" con los campos opcionales:
//   chestCm, waistCm, hipsCm, shouldersCm,
//   leftArmCm, rightArmCm, leftThighCm, rightThighCm, calfCm
// - Notas (textarea)
// - Botón Guardar → POST /api/body-metrics
// - Redireccionar a /progress/body después de guardar

// IMPORTANTE: Los inputs deben ser type="number" con inputMode="decimal"
// para que en iPhone aparezca el teclado numérico
```

### [NEW] `src/components/charts/weight-chart.tsx`

`'use client'` — LineChart que muestra:
- Línea de peso real (puntos)  
- Línea de peso suavizado (EMA, dashed)
- Últimos 90 días

```typescript
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface WeightChartProps {
  data: { date: string; weight: number; smoothed: number }[];
}
```

### [NEW] `src/lib/smoothing.ts`

Función para calcular la media móvil exponencial (EMA):

```typescript
// EMA con alpha configurable (default 0.1 para suavizado fuerte)
export function calculateEMA(values: (number | null)[], alpha?: number): number[] {
  const a = alpha ?? 0.1;
  const result: number[] = [];
  let ema: number | null = null;

  for (const val of values) {
    if (val === null) continue;
    if (ema === null) {
      ema = val;
    } else {
      ema = a * val + (1 - a) * ema;
    }
    result.push(Math.round(ema * 100) / 100);
  }
  return result;
}

// Detectar recomposición: peso estable (±1kg en 4 semanas) + e1RM sube (≥3%)
export interface RecompositionResult {
  isRecomposition: boolean;
  weightDelta: number;       // kg
  strengthDelta: number;     // % cambio e1RM promedio
  message: string;
}

export function detectRecomposition(
  weights: { date: Date; weightKg: number }[],
  e1rmTrends: { week: number; avgE1rm: number }[]
): RecompositionResult { /* ... */ }
```

---

## Paso 3: Fotos de progreso (ProgressPhoto)

### [NEW] `src/app/api/photos/route.ts`

API para fotos:

```typescript
// POST: Subir foto
// Acepta FormData con campos: file (imagen), angle ("front"|"side"|"back"), notes?
// Guardar la imagen en `public/uploads/progress/` con nombre único
// Crear registro en ProgressPhoto con imageUrl relativo

// GET: Obtener historial de fotos
// Query params: userId, angle? (filtrar por ángulo)
// Ordenar por date DESC
```

> **NOTA:** Al guardar en `public/uploads/progress/`, la imagen será accesible
> directamente como `/uploads/progress/filename.jpg`. Añadir `public/uploads/`
> al `.gitignore` para no commitear fotos.

### [NEW] `src/app/(dashboard)/progress/photos/page.tsx` (Server Component)

Página de fotos de progreso:

```typescript
export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const photos = await prisma.progressPhoto.findMany({
    where: { userId: "default-user" },
    orderBy: { date: "desc" },
  });

  // Agrupar fotos por fecha
  // Mostrar galería con botón "Añadir foto"
  // Botón "Comparar" para entrar en modo comparación

  return (
    // Header con botón "📸 Añadir foto"
    // Filtro por ángulo (front | side | back | todos)
    // Grid de fotos agrupadas por fecha
    // Botón flotante "Comparar" si hay ≥2 fotos
  );
}
```

### [NEW] `src/app/(dashboard)/progress/photos/add/page.tsx` (Client Component)

Formulario de subida:

```typescript
"use client";

// - Input type="file" accept="image/*" capture="environment"
//   (en iPhone abre cámara directamente)
// - Select de ángulo: Frontal / Lateral / Espalda
// - Preview de la imagen seleccionada
// - Notas opcionales
// - Botón Subir → POST /api/photos (FormData)
// - Redireccionar a /progress/photos después

// IMPORTANTE: Mostrar preview con URL.createObjectURL
// Desactivar botón si no hay imagen seleccionada
```

### [NEW] `src/app/(dashboard)/progress/photos/compare/page.tsx` (Client Component)

Comparación lado a lado (antes/después):

```typescript
"use client";

// Props vía searchParams: ?angle=front (o el ángulo seleccionado)
// Cargar fotos del ángulo seleccionado, ordenadas por fecha
// UI: dos columnas con fecha y foto
// - Columna izquierda: Select para elegir foto "Antes"
// - Columna derecha: Select para elegir foto "Después"
// - Las fotos se muestran a 50% de ancho cada una
// - Slider opcional (como los de antes/después de diseño web)

// Mobile: las fotos se apilan verticalmente (flex-col en <640px)
```

---

## Paso 4: Integrar en la página de Progreso

### [MODIFY] `src/app/(dashboard)/progress/page.tsx`

Añadir nuevos tabs/secciones a la página existente:

1. **Añadir tab "Score"** como primer tab con el `ScoreCard` y `ScoreTrendChart`
2. **Añadir tab "Cuerpo"** con:
   - Peso actual y tendencia (mini-gráfica inline)
   - Enlace a `/progress/body` para detalle
   - Indicador de recomposición si aplica
3. **Añadir tab "Fotos"** con:
   - Últimas 3 fotos como preview
   - Enlace a `/progress/photos` para ver todas

Las tabs resultantes deben ser: **Score | Volumen | PRs | Cuerpo | Fotos | Tendencias**

### [MODIFY] `src/app/(dashboard)/page.tsx` (Home)

Reemplazar el placeholder del score card con datos reales:
- Importar `calculateScore` de `@/lib/score`
- Hacer queries de las últimas 4 semanas
- Renderizar el `ScoreCard` con los datos

---

## Paso 5: Actualizar `.gitignore` y ROADMAP

### [MODIFY] `.gitignore`

Añadir:
```
# Progress photos (user data)
public/uploads/
```

### [MODIFY] `docs/ROADMAP.md`

Marcar Fase 3 como completada con `[x]` en todos los items.

---

## Resumen de archivos

| Acción | Archivo | Tipo |
|--------|---------|------|
| NEW | `src/lib/score.ts` | Utility (funciones puras) |
| NEW | `src/lib/smoothing.ts` | Utility (EMA + recomposición) |
| NEW | `src/components/score-card.tsx` | Server Component |
| NEW | `src/components/charts/score-trend-chart.tsx` | Client Component |
| NEW | `src/components/charts/weight-chart.tsx` | Client Component |
| NEW | `src/app/api/body-metrics/route.ts` | API Route |
| NEW | `src/app/api/photos/route.ts` | API Route |
| NEW | `src/app/(dashboard)/progress/body/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/progress/body/add/page.tsx` | Client Component |
| NEW | `src/app/(dashboard)/progress/photos/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/progress/photos/add/page.tsx` | Client Component |
| NEW | `src/app/(dashboard)/progress/photos/compare/page.tsx` | Client Component |
| MODIFY | `src/app/(dashboard)/progress/page.tsx` | Server Component |
| MODIFY | `src/app/(dashboard)/page.tsx` | Server Component |
| MODIFY | `.gitignore` | Config |
| MODIFY | `docs/ROADMAP.md` | Docs |

**Total: 12 archivos nuevos + 4 modificados**

---

## Verificación

1. `npx next build` compila sin errores
2. Con PostgreSQL corriendo:
   - `/progress` muestra las 6 tabs (Score, Volumen, PRs, Cuerpo, Fotos, Tendencias)
   - Score card muestra número 0-100 y desglose de 4 dimensiones
   - `/progress/body` muestra formulario de peso/medidas y gráfica
   - `/progress/body/add` permite registrar nueva medición
   - `/progress/photos` muestra galería de fotos
   - `/progress/photos/add` permite subir foto desde cámara o galería
   - `/progress/photos/compare` permite comparación lado a lado
   - Home (`/`) muestra el score real en vez de "--"
3. El peso suavizado (EMA) se muestra como línea discontinua en la gráfica
4. La detección de recomposición muestra badge cuando aplica
5. Las fotos se guardan en `public/uploads/progress/` y se renderizan correctamente
6. Los inputs numéricos muestran teclado numérico en iPhone (inputMode="decimal")
7. Responsive: todo funciona correctamente a 390px de ancho

---

## Reglas importantes

- **Commits en primera persona** → `feat(score): implemento cálculo del score global con 4 dimensiones`
- **Server Components** para queries de Prisma. `'use client'` SOLO para:
  - Gráficas de Recharts
  - Formularios con estado (file upload, inputs controlados)
  - Comparación de fotos interactiva
- **Usar `cn()`** de `@/lib/utils` para clases condicionales
- **`force-dynamic`** en todas las páginas que hagan queries a Prisma
- **Mobile-first** — Diseñar para 390px de ancho
- **Teclado numérico** — Usar `inputMode="decimal"` en inputs de peso/medidas
- **No crear tests** en esta fase (se harán en Fase 8)
- **NO modificar `prisma/schema.prisma`** — Los modelos `BodyMetric` y `ProgressPhoto` ya existen
- **Fotos al `.gitignore`** — No commitear las imágenes subidas por el usuario
