# Plan de Implementación — Fase 5: Apple Watch — iOS Shortcuts

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Documentación de referencia OBLIGATORIA

1. **`docs/explanation/APPLE_WATCH_INTEGRATION.md`** — Pipeline Watch→Health→Shortcut→API→DB, métricas, fallback 4 niveles, seguridad Bearer
2. **`.agents/skills/nextjs-react-typescript/SKILL.md`** — Patrones de Next.js/React/TS
3. **`.agents/skills/git-workflow/SKILL.md`** — Conventional Commits + Git Flow
4. **`.agents/skills/pwa-development/SKILL.md`** — Background Sync para envío offline

**Lee las 4 referencias ANTES de escribir código.**

---

## Contexto del Proyecto

### Stack
- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Prisma 6 · PostgreSQL · Recharts · OpenAI SDK

### Archivos existentes relevantes
| Archivo | Propósito |
|---------|-----------|
| `src/lib/score.ts` | `calculateScore()` — ya tiene slot para recovery |
| `src/lib/smoothing.ts` | `calculateEMA()` reutilizable para métricas fisiológicas |
| `src/lib/ai-context.ts` | Prompt system — ya carga `latestRecovery` |
| `public/offline.html` | Página offline ya creada |
| `.env.example` | Ya incluye `API_TOKEN` |

### Modelo Prisma (NO modificar schema)
```prisma
model RecoverySnapshot {
  id, userId, sessionId? (unique), date (Date),
  hrvMs?, restingHrBpm?, sleepHours?, steps?, activeEnergyKcal?,
  spo2?, bodyTemperature?, respiratoryRate?,
  subjectiveEnergy? (1-10), stressLevel? (1-10),
  source ("shortcut"|"manual"|"xml_import"), createdAt
  @@unique([userId, date])
  @@index([userId, date])
}
```

---

## Reglas de las skills aplicadas

### Skill: `nextjs-react-typescript`
- **Interfaces** sobre types; evitar enums → usar maps
- **Named exports** para todos los componentes
- **Minimizar `'use client'`** → Server Components por defecto, `'use client'` solo para gráficas interactivas y formularios con estado
- **Wrap client components en `<Suspense>`** con fallback skeleton
- **`nuqs`** para URL search params si se usan filtros (ej: filtro por fecha en historial)
- **`function` keyword** para funciones puras
- **Variables descriptivas** con verbos auxiliares: `isLoading`, `hasError`, `hasFallback`
- **Organización de archivos**: componente exportado → subcomponentes → helpers → tipos
- **Dynamic loading** con `next/dynamic` para gráficas (no son críticas para LCP)

### Skill: `git-workflow`
- **Conventional Commits** con tipo+scope+subject+body:
  ```
  feat(recovery): implemento endpoint POST /api/recovery con Bearer auth

  Valida token vía header Authorization: Bearer <token>.
  Parsea body con Zod (13 campos opcionales).
  Upsert por día con @@unique([userId, date]).
  ```
- **Atomic commits** — un commit por funcionalidad
- **Git Flow** desde `develop`, branch `feature/apple-watch`

### Skill: `pwa-development`
- **Background Sync** para los datos del Shortcut → si el POST falla offline, se reintenta automáticamente al recuperar conexión
- **Network First** para `/api/recovery` GET (datos frescos, fallback a cache)
- **Offline detection** en el formulario manual → mostrar aviso si navigator.onLine es false

---

## Git: Branch y commits

```bash
git checkout develop && git pull origin develop
git checkout -b feature/apple-watch
```

### Commits (en orden):
```bash
# 1
git commit -m "feat(recovery): implemento endpoint POST /api/recovery con Bearer auth

Valida token vía Authorization header. Parsea body con Zod.
Upsert por @@unique([userId, date]). Soporta los 13 campos
del RecoverySnapshot incluyendo señales manuales."

# 2
git commit -m "feat(recovery): implemento fallback automático con media 7 días

Si un campo viene null (Shortcuts no pudo leerlo), calcula la
media de los últimos 7 snapshots. 4 niveles: dato → media 7d →
valor subjetivo → omitir."

# 3
git commit -m "feat(recovery): implemento vista de métricas fisiológicas

Dashboard de recuperación con cards (HRV, FC, sueño, energía),
gráfica multi-eje con Recharts y registro manual.
Wraps client components en Suspense con skeleton."

# 4
git commit -m "feat(recovery): integro datos de recovery con score y chat IA

El score global usa los datos reales de RecoverySnapshot.
ai-context.ts incluye las métricas en el prompt del sistema."

# 5
git commit -m "docs(roadmap): marco la Fase 5 como completada"
```

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/apple-watch -m "merge: integro Apple Watch recovery via Shortcuts en develop"
git push origin feature/apple-watch && git push origin develop
```

---

## Paso 1: Instalar dependencias

```bash
npm install zod nuqs
```
> `zod` para validación, `nuqs` para filtros URL en el historial de recovery.

---

## Paso 2: Endpoint POST /api/recovery

### [NEW] `src/app/api/recovery/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyFallback } from "@/lib/recovery-fallback";

// ==================== SCHEMA ZOD ====================

const recoverySchema = z.object({
  userId: z.string().default("default-user"),
  hrvMs: z.number().positive().nullable().optional(),
  restingHrBpm: z.number().int().positive().nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  steps: z.number().int().min(0).nullable().optional(),
  activeEnergyKcal: z.number().min(0).nullable().optional(),
  spo2: z.number().min(0).max(100).nullable().optional(),
  bodyTemperature: z.number().min(30).max(45).nullable().optional(),
  respiratoryRate: z.number().min(5).max(60).nullable().optional(),
  subjectiveEnergy: z.number().int().min(1).max(10).nullable().optional(),
  stressLevel: z.number().int().min(1).max(10).nullable().optional(),
});

// ==================== AUTH ====================
// Skill: nextjs-react-typescript → función pura con function keyword
function validateBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === process.env.API_TOKEN;
}

// ==================== HANDLERS ====================

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = recoverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aplicar fallback de 4 niveles (APPLE_WATCH_INTEGRATION.md)
  const filledData = await applyFallback(data.userId, data);

  const snapshot = await prisma.recoverySnapshot.upsert({
    where: { userId_date: { userId: data.userId, date: today } },
    update: { ...filledData, source: "shortcut" },
    create: { userId: data.userId, date: today, ...filledData, source: "shortcut" },
  });

  return NextResponse.json(snapshot, { status: 201 });
}

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const limit = parseInt(searchParams.get("limit") || "30");

  const snapshots = await prisma.recoverySnapshot.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: Math.min(limit, 90),
  });

  return NextResponse.json(snapshots);
}
```

---

## Paso 3: Fallback automático (4 niveles)

### [NEW] `src/lib/recovery-fallback.ts`

Implementa `APPLE_WATCH_INTEGRATION.md` líneas 71-95:

```typescript
import { prisma } from "./prisma";

// Skill: nextjs-react-typescript → interfaces, no types
interface RecoveryData {
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

// Skill: nextjs-react-typescript → function keyword para funciones puras
// Skill: → variables descriptivas (hasNullFields, hasFallbackData)
export async function applyFallback(
  userId: string,
  data: RecoveryData
): Promise<RecoveryData> {
  const numericFields = [
    "hrvMs", "restingHrBpm", "sleepHours", "steps",
    "activeEnergyKcal", "spo2", "bodyTemperature", "respiratoryRate",
  ] as const;

  const hasNullFields = numericFields.some(
    (f) => data[f] === null || data[f] === undefined
  );
  if (!hasNullFields) return data;

  // Nivel 2: Media móvil 7 días
  const recent = await prisma.recoverySnapshot.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 7,
  });

  const hasFallbackData = recent.length > 0;
  if (!hasFallbackData) return data; // Nivel 4: dato ausente, no afecta score

  const filled = { ...data };

  for (const field of numericFields) {
    if (filled[field] === null || filled[field] === undefined) {
      const values = recent
        .map((s) => s[field] as number | null)
        .filter((v): v is number => v !== null);
      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        (filled as Record<string, unknown>)[field] = Math.round(avg * 100) / 100;
      }
    }
  }

  return filled;
}
```

---

## Paso 4: Registro manual (sin Bearer)

### [NEW] `src/app/api/recovery/manual/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyFallback } from "@/lib/recovery-fallback";

const manualSchema = z.object({
  userId: z.string().default("default-user"),
  subjectiveEnergy: z.number().int().min(1).max(10),
  stressLevel: z.number().int().min(1).max(10).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  notes: z.string().optional(),
});

// POST sin Bearer auth (se usa desde la propia app, no desde Shortcut)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aplicar fallback para métricas de Watch
  const filledData = await applyFallback(data.userId, {
    subjectiveEnergy: data.subjectiveEnergy,
    stressLevel: data.stressLevel ?? null,
    sleepHours: data.sleepHours ?? null,
  });

  const snapshot = await prisma.recoverySnapshot.upsert({
    where: { userId_date: { userId: data.userId, date: today } },
    update: { ...filledData, source: "manual" },
    create: { userId: data.userId, date: today, ...filledData, source: "manual" },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
```

---

## Paso 5: Dashboard de Recovery

### [NEW] `src/app/(dashboard)/progress/recovery/page.tsx` (Server Component)

```typescript
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic_config = "force-dynamic"; // alias to avoid conflict with next/dynamic
export { dynamic_config as dynamic };

// Skill: nextjs-react-typescript → dynamic loading para gráficas (no críticas para LCP)
const RecoveryChart = dynamic(
  () => import("@/components/charts/recovery-chart").then((m) => m.RecoveryChart),
  { ssr: false, loading: () => <div className="h-[250px] animate-pulse bg-muted rounded-lg" /> }
);

export default async function RecoveryPage() {
  const snapshots = await prisma.recoverySnapshot.findMany({
    where: { userId: "default-user" },
    orderBy: { date: "desc" },
    take: 30,
  });

  const latest = snapshots[0] ?? null;
  const avg7d = /* calcular medias de últimos 7 */ {};

  // Skill: nextjs-react-typescript → variables descriptivas
  const hasRecentData = snapshots.length > 0;
  const isHRVDeclining = /* HRV actual < media 7d * 0.85 */;
  const isSleepLow = latest?.sleepHours !== null && (latest?.sleepHours ?? 8) < 6;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Recuperación</h1>
        <Button asChild size="sm" variant="outline">
          <Link href="/progress/recovery/add">Registrar</Link>
        </Button>
      </div>

      {/* Cards 2x2: HRV, FC reposo, Sueño, Energía */}
      {/* Cada card: valor actual, media 7d, tendencia ↑↓→ */}
      {/* Alertas en rojo: isHRVDeclining, isSleepLow */}

      {/* Skill: nextjs-react-typescript → Suspense wrapper */}
      <Suspense fallback={<div className="h-[250px] animate-pulse bg-muted rounded-lg" />}>
        <RecoveryChart data={snapshots.map((s) => ({
          date: s.date.toISOString().split("T")[0],
          hrv: s.hrvMs,
          restingHr: s.restingHrBpm,
          sleep: s.sleepHours,
        }))} />
      </Suspense>

      {/* Tabla últimos 7 snapshots con source badge (🤖 shortcut | ✏️ manual) */}
    </div>
  );
}
```

### [NEW] `src/app/(dashboard)/progress/recovery/add/page.tsx` (Client Component)

```typescript
"use client";

// Skill: nextjs-react-typescript → minimize useState, usar variables descriptivas
// Skill: pwa-development → offline detection

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddRecoveryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    // POST /api/recovery/manual
    // Si offline → mostrar aviso "Se guardará cuando vuelvas a tener conexión"
  }

  return (
    // Formulario con:
    // - Energía subjetiva (1-10) → buttons o slider visual
    // - Estrés percibido (1-10) → buttons
    // - Horas de sueño → input type="number" inputMode="decimal"
    // - Banner offline si isOffline === true
    // - Botón deshabilitado si isSubmitting
  );
}
```

### [NEW] `src/components/charts/recovery-chart.tsx` (Client Component)

```typescript
"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// Skill: nextjs-react-typescript → interfaces
interface RecoveryChartProps {
  data: {
    date: string;
    hrv: number | null;
    restingHr: number | null;
    sleep: number | null;
  }[];
}

// Skill: nextjs-react-typescript → named export
export function RecoveryChart({ data }: RecoveryChartProps) {
  // Filtrar los últimos 30 días, reverse para cronológico
  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" /* HRV */ />
        <YAxis yAxisId="right" orientation="right" /* FC */ />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="hrv" name="HRV (ms)" stroke="#22c55e" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="restingHr" name="FC reposo" stroke="#ef4444" dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="sleep" name="Sueño (h)" stroke="#3b82f6" dot={false} strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Paso 6: Integración con Score + IA

### [MODIFY] `src/lib/score.ts`
Verificar que `calculateRecoveryScore()` usa datos de `RecoverySnapshot`:
- Sueño ≥7h → 100, 6h → 60, <5h → 20
- HRV ≥ media personal → 80+, < media-15% → 40
- FC reposo <60 → 100, 60-70 → 70, >70 → 40
- Energía subjetiva: directa (×10)

### [MODIFY] `src/app/(dashboard)/progress/page.tsx`
Añadir card/enlace a `/progress/recovery` con mini-preview del último snapshot.

### [MODIFY] `docs/ROADMAP.md`
Marcar Fase 5: `[x]` en todos los items.

---

## Resumen de archivos

| Acción | Archivo | Tipo | Skill aplicada |
|--------|---------|------|----------------|
| NEW | `src/app/api/recovery/route.ts` | API Route | Zod, Bearer auth |
| NEW | `src/app/api/recovery/manual/route.ts` | API Route | Zod |
| NEW | `src/lib/recovery-fallback.ts` | Utility | Interfaces, function keyword |
| NEW | `src/app/(dashboard)/progress/recovery/page.tsx` | Server Component | Suspense, dynamic loading |
| NEW | `src/app/(dashboard)/progress/recovery/add/page.tsx` | Client Component | Offline detection (PWA skill) |
| NEW | `src/components/charts/recovery-chart.tsx` | Client Component | Named export |
| MODIFY | `src/lib/score.ts` | Utility | Verificar integración |
| MODIFY | `src/app/(dashboard)/progress/page.tsx` | Server Component | Enlace recovery |
| MODIFY | `docs/ROADMAP.md` | Docs | — |

---

## Verificación

1. `npx next build` compila sin errores
2. **Test con curl:**
```bash
# ✅ 201 Created
curl -X POST http://localhost:3000/api/recovery \
  -H "Authorization: Bearer TU_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hrvMs":52,"restingHrBpm":58,"sleepHours":7.5,"steps":8000,"subjectiveEnergy":7}'

# ❌ 401 sin token
curl -X POST http://localhost:3000/api/recovery \
  -H "Content-Type: application/json" -d '{"hrvMs":52}'

# ❌ 400 datos inválidos (sleepHours fuera de rango)
curl -X POST http://localhost:3000/api/recovery \
  -H "Authorization: Bearer TU_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"sleepHours":30}'
```
3. `/progress/recovery` carga con Suspense skeleton → luego muestra gráfica
4. `/progress/recovery/add` muestra banner offline si sin conexión
5. Fallback rellena campos null con media 7d
6. Score global refleja los datos de recovery
7. Responsive 390px
