# Plan de Implementación — Fase 5: Apple Watch — iOS Shortcuts

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.
> Referencia principal: `docs/explanation/APPLE_WATCH_INTEGRATION.md` (133 líneas con pipeline, fallback y seguridad).

---

## Contexto del Proyecto

### Stack actual
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI:** Shadcn UI (`src/components/ui/`)
- **ORM:** Prisma 6 con PostgreSQL (`prisma/schema.prisma`)
- **Gráficas:** Recharts (`src/components/charts/`)
- **IA:** OpenAI SDK + streaming SSE (`src/lib/openai.ts`, `src/lib/ai-context.ts`)
- **Score:** `src/lib/score.ts` (ya usa datos de recovery si existen)
- **Skills:** `.agents/skills/` — `nextjs-react-typescript`, `git-workflow`

### Archivos existentes clave

| Archivo | Propósito |
|---------|-----------|
| `src/lib/score.ts` | Score global — ya tiene `calculateRecoveryScore()` que usa `sleepHours`, `hrvMs`, `restingHrBpm`, `subjectiveEnergy` |
| `src/lib/smoothing.ts` | `calculateEMA()` — reutilizable para media móvil de métricas fisiológicas |
| `src/lib/ai-context.ts` | Prompt del sistema — ya carga `latestRecovery` de Prisma |
| `docs/explanation/APPLE_WATCH_INTEGRATION.md` | **LEER OBLIGATORIAMENTE** — Explica el pipeline Watch→Health→Shortcut→API→DB |

### Modelo Prisma YA existente (NO modificar schema)

```prisma
model RecoverySnapshot {
  id               String   @id @default(cuid())
  userId           String
  sessionId        String?  @unique
  date             DateTime @db.Date
  hrvMs            Float?      // SDNN
  restingHrBpm     Int?
  sleepHours       Float?
  steps            Int?
  activeEnergyKcal Float?
  spo2             Float?
  bodyTemperature  Float?
  respiratoryRate  Float?
  subjectiveEnergy Int?        // 1-10, manual
  stressLevel      Int?        // 1-10, manual
  source           String   @default("shortcut") // shortcut | manual | xml_import
  createdAt        DateTime @default(now())

  @@unique([userId, date])
  @@index([userId, date])
}
```

---

## Skills a consultar ANTES de codificar

1. **Lee** `.agents/skills/nextjs-react-typescript/SKILL.md` — Route Handlers, Zod validation
2. **Lee** `.agents/skills/git-workflow/SKILL.md` — Conventional Commits en primera persona
3. **Lee** `docs/explanation/APPLE_WATCH_INTEGRATION.md` — **OBLIGATORIO** — Pipeline completo, métricas, fallback 4 niveles, seguridad Bearer.

---

## Git: Branch y commits

```bash
git checkout develop
git pull origin develop
git checkout -b feature/apple-watch
```

### Commits a hacer (en orden):
1. `feat(recovery): implemento endpoint POST /api/recovery con Bearer auth y validación Zod`
2. `feat(recovery): implemento fallback automático con media 7 días`
3. `feat(recovery): implemento vista de métricas fisiológicas con gráficas`
4. `feat(recovery): integro datos de recovery con el score global y el chat IA`
5. `docs(roadmap): marco la Fase 5 como completada`

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/apple-watch -m "merge: integro Apple Watch recovery via Shortcuts en develop"
git push origin feature/apple-watch
git push origin develop
```

---

## Paso 1: Instalar dependencias

```bash
npm install zod
```

> Zod ya está en el proyecto si lo instaló la Fase 4. Verificar con `npm ls zod`.

---

## Paso 2: Endpoint POST /api/recovery

### [NEW] `src/app/api/recovery/route.ts`

Endpoint que recibe datos del iOS Shortcut. **Seguridad con Bearer token**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ==================== VALIDACIÓN ====================

const recoverySchema = z.object({
  // Requeridos
  userId: z.string().default("default-user"),
  // Opcionales — Shortcuts puede no leer todas las métricas
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

function validateBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.API_TOKEN;
}

// ==================== HANDLERS ====================

export async function POST(request: NextRequest) {
  // 1. Validar Bearer token
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Parsear y validar body con Zod
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

  // 3. Aplicar fallback para campos null (media 7 días)
  const filledData = await applyFallback(data.userId, data);

  // 4. Upsert (un snapshot por día por usuario)
  const snapshot = await prisma.recoverySnapshot.upsert({
    where: {
      userId_date: { userId: data.userId, date: today },
    },
    update: { ...filledData, source: "shortcut", userId: undefined },
    create: {
      userId: data.userId,
      date: today,
      ...filledData,
      source: "shortcut",
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}

// GET: Historial de snapshots
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
    take: limit,
  });

  return NextResponse.json(snapshots);
}
```

---

## Paso 3: Función de Fallback Automático

### [NEW] `src/lib/recovery-fallback.ts`

Implementa la estrategia de 4 niveles descrita en `APPLE_WATCH_INTEGRATION.md` líneas 71-95:

```typescript
import { prisma } from "./prisma";

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

// Aplica media móvil de 7 días para campos que vengan null
export async function applyFallback(
  userId: string,
  data: RecoveryData
): Promise<RecoveryData> {
  // Solo buscar historial si hay algún campo null
  const nullFields = Object.entries(data).filter(
    ([key, val]) => val === null || val === undefined
  );
  if (nullFields.length === 0) return data;

  // Cargar últimos 7 snapshots
  const recent = await prisma.recoverySnapshot.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 7,
  });

  if (recent.length === 0) return data;

  const filled = { ...data };

  // Para cada campo numérico null, calcular media de los últimos 7 días
  const numericFields = [
    "hrvMs", "restingHrBpm", "sleepHours", "steps",
    "activeEnergyKcal", "spo2", "bodyTemperature", "respiratoryRate",
  ] as const;

  for (const field of numericFields) {
    if (filled[field] === null || filled[field] === undefined) {
      const values = recent
        .map((s) => s[field])
        .filter((v): v is number => v !== null && v !== undefined);
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

## Paso 4: Endpoint de Registro Manual

### [NEW] `src/app/api/recovery/manual/route.ts`

Endpoint alternativo para registrar recuperación manualmente (sin Shortcut):

```typescript
// POST sin Bearer auth (es desde la propia app)
// Body: { subjectiveEnergy: number, stressLevel?: number, sleepHours?: number, notes?: string }
// Crea o actualiza el snapshot del día con source = "manual"
// Aplica fallback para las métricas de Watch (que no vienen)
```

---

## Paso 5: Vista de Métricas Fisiológicas

### [NEW] `src/app/(dashboard)/progress/recovery/page.tsx` (Server Component)

```typescript
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const snapshots = await prisma.recoverySnapshot.findMany({
    where: { userId: "default-user" },
    orderBy: { date: "desc" },
    take: 30,
  });

  // Calcular:
  // - Medias de 7 días para cada métrica
  // - Tendencia (comparar semana actual vs anterior)
  // - Alertas: HRV bajando >15%, FC subiendo >10%, sueño <6h

  return (
    // Header "Recuperación" con botón "Registrar manualmente"
    //
    // Cards principales (2x2 grid):
    //   - HRV: valor actual, media 7d, tendencia ↑↓→
    //   - FC reposo: valor, media, tendencia
    //   - Sueño: horas, media, tendencia
    //   - Energía: valor subjetivo + estrés
    //
    // Gráfica RecoveryChart (últimos 30 días):
    //   - LineChart con múltiples líneas: HRV, FC, sueño
    //   - Cada métrica con su propio eje Y (dual axis)
    //
    // Tabla con últimos 7 snapshots
    //
    // Alertas en rojo si las hay
  );
}
```

### [NEW] `src/app/(dashboard)/progress/recovery/add/page.tsx` (Client Component)

Formulario de registro manual con:
- Energía subjetiva (1-10) — slider o input con estrellas/emoji
- Estrés percibido (1-10) — slider
- Horas de sueño — input decimal
- Notas opcionales
- Botón Guardar → `POST /api/recovery/manual`

### [NEW] `src/components/charts/recovery-chart.tsx` (Client Component)

`'use client'` — LineChart de Recharts con:
- HRV (eje Y izquierdo)
- FC en reposo (eje Y derecho)
- Sueño (línea secundaria)
- Últimos 30 días
- Tooltip con todos los valores

```typescript
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RecoveryChartProps {
  data: {
    date: string;
    hrv: number | null;
    restingHr: number | null;
    sleep: number | null;
  }[];
}
```

---

## Paso 6: Integración con Score y Chat IA

### [MODIFY] `src/lib/score.ts`

Verificar que `calculateRecoveryScore()` ya utiliza los datos de `RecoverySnapshot`.
Si ya lo hace (implementado en Fase 3), no se necesitan cambios.
Si no, asegurarse de que:
- Sueño ≥7h → 100, 6h → 60, <5h → 20
- HRV: comparar con media personal 7d. Si ≥media → 80+, si <media-15% → 40
- FC reposo: <60 → 100, 60-70 → 70, >70 → 40
- Energía subjetiva: directa (×10)

### [MODIFY] `src/app/(dashboard)/progress/page.tsx`

Añadir enlace/preview a "/progress/recovery" dentro de la tab de alguna tab existente o como nueva.
Mostrar mini-card de recuperación con los últimos datos.

### [MODIFY] `docs/ROADMAP.md`

Marcar Fase 5 como completada con `[x]`.

---

## Resumen de archivos

| Acción | Archivo | Tipo |
|--------|---------|------|
| NEW | `src/app/api/recovery/route.ts` | API Route (Bearer auth + Zod) |
| NEW | `src/app/api/recovery/manual/route.ts` | API Route |
| NEW | `src/lib/recovery-fallback.ts` | Utility |
| NEW | `src/app/(dashboard)/progress/recovery/page.tsx` | Server Component |
| NEW | `src/app/(dashboard)/progress/recovery/add/page.tsx` | Client Component |
| NEW | `src/components/charts/recovery-chart.tsx` | Client Component |
| MODIFY | `src/lib/score.ts` | Verificar integración recovery |
| MODIFY | `src/app/(dashboard)/progress/page.tsx` | Añadir enlace recovery |
| MODIFY | `docs/ROADMAP.md` | Docs |

**Total: 6 archivos nuevos + 3 modificados**

---

## Verificación

1. `npx next build` compila sin errores
2. **Test del endpoint con curl:**
```bash
# Éxito
curl -X POST http://localhost:3000/api/recovery \
  -H "Authorization: Bearer TU_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hrvMs": 52, "restingHrBpm": 58, "sleepHours": 7.5, "steps": 8000, "subjectiveEnergy": 7}'

# Error 401 sin token
curl -X POST http://localhost:3000/api/recovery \
  -H "Content-Type: application/json" \
  -d '{"hrvMs": 52}'

# Error 400 datos inválidos
curl -X POST http://localhost:3000/api/recovery \
  -H "Authorization: Bearer TU_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sleepHours": 30}'
```
3. `/progress/recovery` muestra cards con métricas y gráfica
4. `/progress/recovery/add` permite registrar datos manualmente
5. El fallback rellena campos null con media 7d
6. El score global refleja los datos de recovery
7. Responsive a 390px

---

## Reglas importantes

- **Bearer token** → `process.env.API_TOKEN` — Sin token = 401
- **Zod para validación** — Errores claros con `.flatten()`
- **Upsert por día** → `@@unique([userId, date])` — Un snapshot/día
- **Fallback silencioso** → No alertar al usuario, solo rellenar internamente
- **Server Components** para queries. `'use client'` solo para gráficas y formularios
- **NO crear tests** en esta fase
- **Commits en primera persona**
