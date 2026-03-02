# Plan de Implementación — Fase 7: Gamificación

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.

---

## Documentación de referencia OBLIGATORIA

1. **`.agents/skills/nextjs-react-typescript/SKILL.md`** — Patrones Next.js/React/TS
2. **`.agents/skills/git-workflow/SKILL.md`** — Conventional Commits + Git Flow
3. **`docs/reference/DATA_MODEL.md`** — Modelo Achievement
4. **`src/lib/calculations.ts`** — Función `detectPRs()` existente

**Lee las 4 referencias ANTES de escribir código.**

---

## Contexto del Proyecto

### Stack
- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Prisma 6 · PostgreSQL · Recharts

### Archivos existentes relevantes
| Archivo | Propósito |
|---------|-----------|
| `src/lib/calculations.ts` | `detectPRs()` — detecta PRs de peso, reps, e1RM, volumen |
| `src/lib/score.ts` | Score global 0-100 |
| `src/app/(dashboard)/page.tsx` | Home — añadir rachas y badges recientes |
| `src/app/(dashboard)/train/session/workout-session.tsx` | Logging — disparar detección de PRs y logros |
| `src/app/api/workouts/route.ts` | POST sesión — hook para crear achievements |

### Modelo Prisma (NO modificar schema)
```prisma
model Achievement {
  id          String   @id @default(cuid())
  userId      String
  type        String   // streak | pr | milestone | badge
  name        String
  description String?
  value       Json?    // datos extra: { days: 7 } | { exercise: "Press banca", weight: 100 }
  unlockedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

---

## Reglas de las skills aplicadas

### Skill: `nextjs-react-typescript`
- **Interfaces** sobre types. Evitar enums → usar maps
- **Named exports** para todos los componentes
- **Suspense + dynamic loading** para componentes de logros
- **`function` keyword** para funciones puras (detección de rachas, logros)
- **Variables descriptivas**: `isNewStreak`, `hasUnlockedBadge`, `isPersonalRecord`
- **Server Components** por defecto. `'use client'` solo para animaciones y toasts de logros

### Skill: `git-workflow`
- **Conventional Commits** con body descriptivo
- **Atomic commits** por funcionalidad

---

## Git: Branch y commits

```bash
git checkout develop && git pull origin develop
git checkout -b feature/gamification
```

### Commits (en orden):
```bash
# 1
git commit -m "feat(streaks): implemento sistema de rachas de entrenamiento

Calcula racha actual (días/semanas consecutivos entrenando).
Crea Achievement type='streak' automáticamente al alcanzar
hitos: 3, 7, 14, 21, 30, 60, 90, 180, 365 días."

# 2
git commit -m "feat(prs): implemento alertas de PRs con achievements

Al detectar un PR (peso, reps, e1RM, vol), crea un Achievement
type='pr' y muestra toast animado en la pantalla de resumen
post-sesión. Reutiliza detectPRs() de calculations.ts."

# 3
git commit -m "feat(badges): implemento logros desbloqueables

Sistema de badges por hitos: primer entreno, 100kg press banca,
50 sesiones, 1000kg volumen total, etc. Definidos como mapa
estático con condiciones de desbloqueo."

# 4
git commit -m "feat(ranking): implemento ranking personal temporal

Compara rendimiento actual vs hace 4/8/12 semanas.
Muestra progreso en score, volumen, fuerza, consistencia."

# 5
git commit -m "feat(gamification): integro logros en home y perfil

Home muestra racha actual + último badge. Perfil muestra
todos los achievements con fecha de desbloqueo."

# 6
git commit -m "docs(roadmap): marco la Fase 7 como completada"
```

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/gamification -m "merge: integro gamificación, rachas y badges en develop"
git push origin feature/gamification && git push origin develop
```

---

## Paso 1: Motor de Gamificación (Utilities)

### [NEW] `src/lib/gamification.ts`

```typescript
import { prisma } from "./prisma";
import { calculateE1RM } from "./calculations";

// Skill: nextjs-react-typescript → interfaces, maps en lugar de enums

// ==================== INTERFACES ====================

interface StreakResult {
  currentDays: number;
  currentWeeks: number;
  longestDays: number;
  isNewMilestone: boolean;
  milestone: number | null;  // 3, 7, 14, 21, 30, 60, 90, 180, 365
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;       // emoji
  condition: (stats: UserStats) => boolean;
}

interface UserStats {
  totalSessions: number;
  totalVolume: number;        // kg total (todas las sesiones)
  bestBenchE1rm: number;
  bestSquatE1rm: number;
  bestDeadliftE1rm: number;
  longestStreak: number;
  totalPRs: number;
  firstSessionDate: Date | null;
  bodyweightChange: number;   // kg cambio total
}

interface RankingComparison {
  period: string;            // "4 semanas" | "8 semanas" | "12 semanas"
  scoreChange: number;
  volumeChange: number;      // %
  strengthChange: number;    // % e1RM promedio
  sessionsChange: number;    // diferencia absoluta
}

// ==================== STREAK MILESTONES ====================

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

// Skill: nextjs-react-typescript → function keyword
export async function calculateStreak(userId: string): Promise<StreakResult> {
  const sessions = await prisma.session.findMany({
    where: { userId, status: "completed" },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (sessions.length === 0) {
    return { currentDays: 0, currentWeeks: 0, longestDays: 0, isNewMilestone: false, milestone: null };
  }

  // Calcular días consecutivos con al menos 1 sesión
  // Permitir 1 día de descanso (24-48h gap) entre sesiones
  // Un día "activo" = al menos 1 sesión ese día
  let currentStreak = 1;
  let longestStreak = 1;
  const sortedDates = sessions.map((s) => {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const uniqueDays = [...new Set(sortedDates)].sort((a, b) => b - a);

  for (let i = 1; i < uniqueDays.length; i++) {
    const diffDays = (uniqueDays[i - 1] - uniqueDays[i]) / 86400000;
    if (diffDays <= 2) { // Permitir gap de 1 día de descanso
      currentStreak++;
    } else {
      break;
    }
  }

  // Calcular longest streak (recorrer todo el historial)
  let tempStreak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const diffDays = (uniqueDays[i - 1] - uniqueDays[i]) / 86400000;
    if (diffDays <= 2) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  const milestone = STREAK_MILESTONES.find((m) => currentStreak >= m && currentStreak - 1 < m) || null;

  return {
    currentDays: currentStreak,
    currentWeeks: Math.floor(currentStreak / 7),
    longestDays: longestStreak,
    isNewMilestone: milestone !== null,
    milestone,
  };
}

// ==================== BADGES ====================

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_session",
    name: "Primer Entreno",
    description: "Completaste tu primera sesión",
    icon: "🎯",
    condition: (s) => s.totalSessions >= 1,
  },
  {
    id: "sessions_10",
    name: "Constante",
    description: "10 sesiones completadas",
    icon: "💪",
    condition: (s) => s.totalSessions >= 10,
  },
  {
    id: "sessions_50",
    name: "Dedicado",
    description: "50 sesiones completadas",
    icon: "🔥",
    condition: (s) => s.totalSessions >= 50,
  },
  {
    id: "sessions_100",
    name: "Centurión",
    description: "100 sesiones completadas",
    icon: "🏆",
    condition: (s) => s.totalSessions >= 100,
  },
  {
    id: "volume_10k",
    name: "10 Toneladas",
    description: "10.000 kg de volumen total acumulado",
    icon: "⚡",
    condition: (s) => s.totalVolume >= 10000,
  },
  {
    id: "volume_100k",
    name: "100 Toneladas",
    description: "100.000 kg de volumen total, eres una bestia",
    icon: "🦁",
    condition: (s) => s.totalVolume >= 100000,
  },
  {
    id: "bench_100",
    name: "Club de los 100",
    description: "e1RM de press banca ≥ 100 kg",
    icon: "🏋️",
    condition: (s) => s.bestBenchE1rm >= 100,
  },
  {
    id: "squat_140",
    name: "Piernas de Acero",
    description: "e1RM de sentadilla ≥ 140 kg",
    icon: "🦵",
    condition: (s) => s.bestSquatE1rm >= 140,
  },
  {
    id: "deadlift_180",
    name: "Peso Muerto Élite",
    description: "e1RM de peso muerto ≥ 180 kg",
    icon: "💀",
    condition: (s) => s.bestDeadliftE1rm >= 180,
  },
  {
    id: "streak_30",
    name: "Hábito de Hierro",
    description: "Racha de 30 días entrenando",
    icon: "📅",
    condition: (s) => s.longestStreak >= 30,
  },
  {
    id: "prs_10",
    name: "Cazador de PRs",
    description: "10 récords personales batidos",
    icon: "🎖️",
    condition: (s) => s.totalPRs >= 10,
  },
];

export async function checkAndUnlockBadges(userId: string): Promise<string[]> {
  // 1. Cargar stats del usuario
  const stats = await getUserStats(userId);

  // 2. Cargar badges ya desbloqueados
  const existing = await prisma.achievement.findMany({
    where: { userId, type: "badge" },
    select: { name: true },
  });
  const unlockedNames = new Set(existing.map((a) => a.name));

  // 3. Verificar cada badge
  const newBadges: string[] = [];
  for (const badge of BADGE_DEFINITIONS) {
    if (!unlockedNames.has(badge.name) && badge.condition(stats)) {
      await prisma.achievement.create({
        data: {
          userId,
          type: "badge",
          name: badge.name,
          description: badge.description,
          value: { id: badge.id, icon: badge.icon },
        },
      });
      newBadges.push(`${badge.icon} ${badge.name}`);
    }
  }

  return newBadges;
}

async function getUserStats(userId: string): Promise<UserStats> {
  // Queries para calcular todas las stats necesarias
  // Reutilizar calculateE1RM() para los big 3
}

// ==================== RANKING PERSONAL ====================

export async function calculateRanking(
  userId: string
): Promise<RankingComparison[]> {
  // Comparar rendimiento actual vs hace 4, 8 y 12 semanas
  // Devolver cambios en score, volumen, fuerza y sesiones
}

export { BADGE_DEFINITIONS };
export type { StreakResult, BadgeDefinition, UserStats, RankingComparison };
```

---

## Paso 2: API de Achievements

### [NEW] `src/app/api/achievements/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const type = searchParams.get("type"); // streak | pr | badge | milestone (opcional)

  const achievements = await prisma.achievement.findMany({
    where: {
      userId,
      ...(type ? { type } : {}),
    },
    orderBy: { unlockedAt: "desc" },
  });

  return NextResponse.json(achievements);
}
```

---

## Paso 3: Hook post-sesión para gamificación

### [MODIFY] `src/app/api/workouts/route.ts`

Después de crear la sesión en el POST handler, añadir:

```typescript
import { calculateStreak, checkAndUnlockBadges } from "@/lib/gamification";
import { detectPRs } from "@/lib/calculations";

// ... al final del POST handler, después de crear la sesión:

// 1. Detectar PRs y crear achievements type="pr"
// (ya existe detectPRs() — usarla)
const prs = detectPRs(currentSets, historicalSets, exerciseName, new Date());
for (const pr of prs) {
  await prisma.achievement.create({
    data: {
      userId,
      type: "pr",
      name: `PR ${pr.type}: ${pr.exerciseName}`,
      description: `Nuevo récord de ${pr.type}: ${pr.value}`,
      value: pr,
    },
  });
}

// 2. Verificar racha
const streak = await calculateStreak(userId);
if (streak.isNewMilestone && streak.milestone) {
  await prisma.achievement.create({
    data: {
      userId,
      type: "streak",
      name: `Racha de ${streak.milestone} días`,
      description: `¡${streak.milestone} días seguidos entrenando!`,
      value: { days: streak.milestone },
    },
  });
}

// 3. Verificar badges
const newBadges = await checkAndUnlockBadges(userId);

// Incluir en la response:
return NextResponse.json({
  session,
  gamification: {
    prs,
    streak: { current: streak.currentDays, isNewMilestone: streak.isNewMilestone },
    newBadges,
  },
});
```

---

## Paso 4: Toast de logros en la sesión

### [NEW] `src/components/achievement-toast.tsx` (Client Component)

```typescript
"use client";

// Skill: nextjs-react-typescript → interface, named export

interface AchievementToastProps {
  type: "pr" | "streak" | "badge";
  title: string;
  description: string;
  icon?: string;
}

// Toast animado que aparece al desbloquear un logro
// Animación: slide-in desde arriba + confetti emoji
// Auto-dismiss después de 4 segundos
// Colores por tipo: pr=dorado, streak=verde, badge=morado
export function AchievementToast({ type, title, description, icon }: AchievementToastProps) {
  // Usar CSS animation (translateY + opacity)
  // No usar librería externa de confetti
}
```

### [MODIFY] `src/app/(dashboard)/train/session/workout-session.tsx`

En la pantalla de resumen post-sesión (`sessionFinished`), mostrar los logros recién desbloqueados:
- PRs detectados con `AchievementToast`
- Nueva racha con badge
- Nuevos badges con animación

---

## Paso 5: Página de Logros en el Perfil

### [NEW] `src/app/(dashboard)/profile/achievements/page.tsx` (Server Component)

```typescript
import { prisma } from "@/lib/prisma";
import { calculateStreak, calculateRanking, BADGE_DEFINITIONS } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const userId = "default-user";

  const achievements = await prisma.achievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });

  const streak = await calculateStreak(userId);
  const ranking = await calculateRanking(userId);

  // Skill: nextjs-react-typescript → descriptive variables
  const totalBadges = BADGE_DEFINITIONS.length;
  const unlockedBadges = achievements.filter((a) => a.type === "badge").length;
  const hasAllBadges = unlockedBadges === totalBadges;

  return (
    // Header "Logros" con contador X/Y badges
    //
    // Card RACHA: 🔥 racha actual, 🏆 racha más larga
    //
    // RANKING PERSONAL:
    //   Tabla comparativa vs 4/8/12 semanas atrás
    //   Colores: verde si mejoró, rojo si bajó
    //
    // GRID DE BADGES (3 columnas):
    //   Badge desbloqueado: color + icon + nombre + fecha
    //   Badge bloqueado: gris + candado + nombre + "???"
    //
    // HISTORIAL DE PRs:
    //   Lista cronológica de todos los PRs con badge tipo
  );
}
```

---

## Paso 6: Integrar en Home y Perfil

### [MODIFY] `src/app/(dashboard)/page.tsx`

Añadir en el home:
```typescript
// Racha actual
const streak = await calculateStreak("default-user");
// Último achievement
const latestAchievement = await prisma.achievement.findFirst({
  where: { userId: "default-user" },
  orderBy: { unlockedAt: "desc" },
});
```
Renderizar:
- 🔥 Racha: X días (mini-card)
- Último logro desbloqueado

### [MODIFY] `src/app/(dashboard)/profile/page.tsx`

Añadir enlace a `/profile/achievements`:
```tsx
<Link href="/profile/achievements">
  <Card><CardContent>🏆 Logros (X/Y)</CardContent></Card>
</Link>
```

### [MODIFY] `docs/ROADMAP.md`

Marcar Fase 7: `[x]` en todos los items.

---

## Resumen de archivos

| Acción | Archivo | Tipo | Skill |
|--------|---------|------|-------|
| NEW | `src/lib/gamification.ts` | Utility | Maps, function keyword, interfaces |
| NEW | `src/app/api/achievements/route.ts` | API Route | — |
| NEW | `src/components/achievement-toast.tsx` | Client Component | Named export, CSS animation |
| NEW | `src/app/(dashboard)/profile/achievements/page.tsx` | Server Component | Descriptive vars |
| MODIFY | `src/app/api/workouts/route.ts` | API Route | Hook post-sesión |
| MODIFY | `src/app/(dashboard)/train/session/workout-session.tsx` | Client Component | Toast de logros |
| MODIFY | `src/app/(dashboard)/page.tsx` | Server Component | Racha + último badge |
| MODIFY | `src/app/(dashboard)/profile/page.tsx` | Server Component | Enlace achievements |
| MODIFY | `docs/ROADMAP.md` | Docs | — |

**Total: 4 nuevos + 5 modificados**

---

## Verificación

1. `npx next build` compila sin errores
2. Al completar una sesión:
   - PRs detectados → Achievement creado + toast animado
   - Racha actualizada → si milestone → toast de racha
   - Badges verificados → si nuevo → toast de badge
3. `/profile/achievements` muestra:
   - Grid de badges (desbloqueados en color, bloqueados en gris)
   - Racha actual y más larga
   - Ranking vs 4/8/12 semanas
   - Historial de PRs
4. Home muestra racha actual y último logro
5. Los Achievement se persisten en DB con JSON value
6. Responsive 390px
