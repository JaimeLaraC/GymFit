# Plan de Implementación — Fase 4: Motor de IA — Progresión + Chat

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.
> Referencia principal: `docs/explanation/AI_ENGINE.md` (260 líneas con todas las reglas).

---

## Contexto del Proyecto

### Stack actual
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI:** Shadcn UI (`src/components/ui/`)
- **ORM:** Prisma 6 con PostgreSQL (`prisma/schema.prisma`)
- **Gráficas:** Recharts (`src/components/charts/`)
- **Cálculos:** `src/lib/calculations.ts` (e1RM, volumen, PRs), `src/lib/score.ts`, `src/lib/smoothing.ts`
- **Skills:** `.agents/skills/` — `nextjs-react-typescript`, `git-workflow`

### Archivos existentes clave

| Archivo | Propósito |
|---------|-----------|
| `src/lib/calculations.ts` | `calculateE1RM()`, `calculateVolume()`, `countEffectiveSets()`, `detectPRs()` |
| `src/lib/score.ts` | `calculateScore()` → Score 0-100 con 4 dimensiones |
| `src/app/(dashboard)/ai/page.tsx` | **Placeholder actual** — REEMPLAZAR |
| `src/app/api/workouts/route.ts` | API GET/POST sesiones |
| `src/app/(dashboard)/train/session/workout-session.tsx` | Logging en vivo |
| `docs/explanation/AI_ENGINE.md` | **LEER OBLIGATORIAMENTE** — Contiene todas las reglas de progresión, prompt system, y flujo de decisiones |

### Modelos Prisma relevantes

```prisma
model Session { id, userId, routineId?, date, durationMin?, energyLevel?, overallRPE?, status, workoutSets[] }
model WorkoutSet { id, sessionId, exerciseId, setNumber, reps, weight, rir?, isEffective, exercise }
model Exercise { id, name, primaryMuscle, pattern, equipment, minRepRange, maxRepRange, recommendedRIR }
model RecoverySnapshot { id, userId, date, hrvMs?, restingHrBpm?, sleepHours?, subjectiveEnergy?, stressLevel? }
model Routine { id, programId?, name, exercises RoutineExercise[] }
model RoutineExercise { id, routineId, exerciseId, order, targetSets, targetMinReps, targetMaxReps, targetRIR, restSeconds, method }
```

---

## Skills a consultar ANTES de codificar

1. **Lee** `.agents/skills/nextjs-react-typescript/SKILL.md` — Aplica:
   - Server Components para data fetching
   - `'use client'` SOLO para el chat interactivo (streaming)
   - Route Handlers para la API de IA
   - Streaming con `ReadableStream` en Route Handlers

2. **Lee** `.agents/skills/git-workflow/SKILL.md` — Aplica:
   - Conventional Commits en **primera persona**
   - Commits atómicos por funcionalidad

3. **Lee** `docs/explanation/AI_ENGINE.md` — **OBLIGATORIO** — Contiene:
   - Todas las reglas de progresión (doble progresión, top set + back-off)
   - Reglas de ajuste por recuperación
   - Detección de estancamiento
   - Control de volumen (MEV/MAV/MRV)
   - Detección de junk volume
   - Estructura del prompt system
   - Casos de uso del chat
   - Flujo de decisión post-sesión

---

## Git: Branch y commits

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ai-engine
```

### Commits a hacer (en orden):
1. `feat(progression): implemento motor de reglas de progresión y detección de estancamiento`
2. `feat(ai): implemento cliente OpenAI con streaming SSE`
3. `feat(chat): implemento chat contextual con prompt del usuario y streaming`
4. `feat(routines): implemento generación de rutinas con IA`
5. `feat(analysis): implemento análisis post-sesión y alertas automáticas`
6. `docs(roadmap): marco la Fase 4 como completada`

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/ai-engine -m "merge: integro motor de IA, chat y progresión en develop"
git push origin feature/ai-engine
git push origin develop
```

---

## Paso 1: Instalar dependencias

```bash
npm install zod openai
npm install -D @types/eventsource
```

> Se usa el SDK oficial `openai` para simplificar streaming. Alternativamente
> se puede usar `fetch` directo con `ReadableStream`, pero el SDK gestiona
> mejor los edge cases de streaming SSE.

---

## Paso 2: Motor de Reglas de Progresión

### [NEW] `src/lib/progression.ts`

Motor determinístico de reglas. **Sigue las reglas exactas de `AI_ENGINE.md` (líneas 57-127)**:

```typescript
import { calculateE1RM } from "./calculations";

// ==================== INTERFACES ====================

export interface ProgressionInput {
  exerciseId: string;
  exerciseName: string;
  method: "standard" | "double_progression" | "top_set_backoff" | "rest_pause";
  targetMinReps: number;
  targetMaxReps: number;
  targetRIR: number;
  // Último entrenamiento para este ejercicio
  lastSets: { weight: number; reps: number; rir: number | null }[];
  // Historial de las últimas 6 sesiones
  historicalSessions: {
    date: Date;
    sets: { weight: number; reps: number; rir: number | null }[];
  }[];
}

export interface ProgressionSuggestion {
  type: "increase_weight" | "maintain" | "decrease_weight" | "deload" | "change_exercise";
  newWeight: number | null;
  newRepRange: { min: number; max: number } | null;
  reason: string;        // Explicación en español para el usuario
  confidence: "high" | "medium" | "low";
}

export interface StagnationResult {
  isStagnated: boolean;
  weeksSinceProgress: number;
  suggestion: string;
}

export interface JunkVolumeResult {
  hasJunkVolume: boolean;
  junkSets: number;
  totalSets: number;
  percentage: number;
  suggestion: string;
}

// ==================== FUNCIONES ====================

// Doble Progresión (método por defecto)
// Lee AI_ENGINE.md líneas 61-71 para las reglas exactas
export function evaluateDoubleProgression(input: ProgressionInput): ProgressionSuggestion {
  const { lastSets, targetMaxReps, targetMinReps, targetRIR } = input;
  if (lastSets.length === 0) return { type: "maintain", newWeight: null, newRepRange: null, reason: "Sin datos", confidence: "low" };

  const avgReps = lastSets.reduce((s, set) => s + set.reps, 0) / lastSets.length;
  const avgRIR = lastSets.reduce((s, set) => s + (set.rir ?? targetRIR), 0) / lastSets.length;
  const allAtMaxReps = lastSets.every((s) => s.reps >= targetMaxReps);
  const weight = lastSets[0].weight;

  // SI todas series en rango alto + RIR medio ≤ objetivo+1 → SUBIR
  if (allAtMaxReps && avgRIR <= targetRIR + 1) {
    const increment = weight >= 60 ? 2.5 : 1.25; // <60kg: +1.25, ≥60kg: +2.5
    return {
      type: "increase_weight",
      newWeight: weight + increment,
      newRepRange: { min: targetMinReps, max: targetMaxReps },
      reason: `Todas las series en ${targetMaxReps} reps con RIR ≈ ${targetRIR}. Sube a ${weight + increment}kg.`,
      confidence: "high",
    };
  }

  // SI no alcanza rango mínimo 2+ sesiones → BAJAR
  const recentBelowMin = input.historicalSessions
    .slice(0, 2)
    .filter((s) => s.sets.some((set) => set.reps < targetMinReps));
  if (recentBelowMin.length >= 2) {
    const reduction = Math.round(weight * 0.1 * 2) / 2; // 10%, redondeado a 0.5
    return {
      type: "decrease_weight",
      newWeight: weight - reduction,
      newRepRange: { min: targetMinReps, max: targetMaxReps },
      reason: `No alcanzas ${targetMinReps} reps en 2+ sesiones. Baja a ${weight - reduction}kg y reinicia progresión.`,
      confidence: "high",
    };
  }

  // SI no se cumple ninguna condición → MANTENER
  return {
    type: "maintain",
    newWeight: weight,
    newRepRange: null,
    reason: `Mantén ${weight}kg. Intenta alcanzar ${targetMaxReps} reps en todas las series.`,
    confidence: "medium",
  };
}

// Detección de estancamiento (AI_ENGINE.md líneas 100-112)
export function detectStagnation(input: ProgressionInput): StagnationResult {
  // Comparar e1RM de las últimas 6 sesiones
  // Si no mejora en 3-6 semanas → meseta
}

// Detección de junk volume (AI_ENGINE.md líneas 124-127)
export function detectJunkVolume(
  weeklySets: { rir: number | null }[]
): JunkVolumeResult {
  const total = weeklySets.length;
  const junk = weeklySets.filter((s) => s.rir !== null && s.rir > 4).length;
  const pct = total > 0 ? Math.round((junk / total) * 100) : 0;
  return {
    hasJunkVolume: pct > 30,
    junkSets: junk,
    totalSets: total,
    percentage: pct,
    suggestion: pct > 30
      ? `${pct}% de tus series son junk volume (RIR > 4). Reduce series y acércate más al fallo.`
      : "",
  };
}

// Análisis post-sesión: reúne todas las evaluaciones
export interface PostSessionAnalysis {
  progressions: ProgressionSuggestion[];
  stagnations: StagnationResult[];
  junkVolume: JunkVolumeResult;
  alerts: string[];
}

export function analyzeSession(/* params */): PostSessionAnalysis {
  // Por cada ejercicio de la sesión:
  //   1. evaluateDoubleProgression()
  //   2. detectStagnation()
  // Globalmente:
  //   3. detectJunkVolume()
  // Devolver alertas agregadas
}
```

---

## Paso 3: Cliente OpenAI con Streaming

### [NEW] `src/lib/openai.ts`

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export { openai };
```

### [NEW] `src/lib/ai-context.ts`

Construye el contexto del usuario para el prompt system. **Sigue la estructura de `AI_ENGINE.md` líneas 133-174**:

```typescript
import { prisma } from "./prisma";
import { calculateE1RM, calculateVolume, countEffectiveSets } from "./calculations";
import { calculateScore } from "./score";

export interface UserContext {
  systemPrompt: string;
  userSummary: string;
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  // 1. Cargar datos del usuario
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // 2. Últimas 5 sesiones con sets y ejercicios
  const recentSessions = await prisma.session.findMany({
    where: { userId, status: "completed" },
    orderBy: { date: "desc" },
    take: 5,
    include: { workoutSets: { include: { exercise: true } } },
  });

  // 3. Última recovery snapshot
  const latestRecovery = await prisma.recoverySnapshot.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // 4. Últimas body metrics
  const latestMetrics = await prisma.bodyMetric.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // 5. Score actual
  // Calcular score usando los datos disponibles

  // 6. Top 5 ejercicios por e1RM
  // Calcular e1RM de cada ejercicio reciente

  // 7. Alertas activas (junk volume, estancamientos, sueño bajo)

  // 8. Construir el system prompt siguiendo AI_ENGINE.md líneas 138-174
  const systemPrompt = `Eres un entrenador personal experto en hipertrofia y fuerza, basado en evidencia científica.
Tienes acceso a los datos reales del usuario y debes tomar decisiones racionales.
Nunca inventes datos. Si no tienes información suficiente, dilo claramente.
Prioriza: seguridad > recuperación > progresión > volumen.
Responde siempre en español. Sé conciso y directo.`;

  const userSummary = `[CONTEXTO DEL USUARIO]
- Nombre: ${user?.name}
- Nivel: ${user?.level}
- Objetivo: ${user?.goal}
...construir el resto con los datos cargados...`;

  return { systemPrompt, userSummary };
}
```

---

## Paso 4: API de Chat con Streaming SSE

### [NEW] `src/app/api/ai/chat/route.ts`

```typescript
import { NextRequest } from "next/server";
import { openai, AI_MODEL } from "@/lib/openai";
import { buildUserContext } from "@/lib/ai-context";

export async function POST(request: NextRequest) {
  const { message, userId = "default-user" } = await request.json();

  if (!message) {
    return new Response(JSON.stringify({ error: "message es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Construir contexto
  const { systemPrompt, userSummary } = await buildUserContext(userId);

  // Streaming con OpenAI SDK
  const stream = await openai.chat.completions.create({
    model: AI_MODEL,
    stream: true,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${userSummary}` },
      { role: "user", content: message },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  // Convertir a ReadableStream para Next.js
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

## Paso 5: API de Generación de Rutinas

### [NEW] `src/app/api/ai/generate-routine/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { openai, AI_MODEL } from "@/lib/openai";
import { buildUserContext } from "@/lib/ai-context";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const {
    userId = "default-user",
    type = "ppl",        // ppl | upper_lower | full_body | custom
    daysPerWeek = 4,
    durationMin = 60,
    focus,               // músculo prioritario (opcional)
  } = await request.json();

  const { systemPrompt, userSummary } = await buildUserContext(userId);

  // Cargar ejercicios disponibles
  const exercises = await prisma.exercise.findMany({
    where: { isAvoided: false },
    select: { id: true, name: true, primaryMuscle: true, pattern: true, equipment: true },
  });

  const routinePrompt = `Genera una rutina de entrenamiento con estos parámetros:
- Tipo: ${type}
- Días/semana: ${daysPerWeek}
- Duración por sesión: ${durationMin} minutos
${focus ? `- Músculo prioritario: ${focus}` : ""}

Usa SOLO ejercicios de esta lista (incluye el ID exacto):
${JSON.stringify(exercises, null, 2)}

Responde en JSON con este formato exacto:
{
  "name": "nombre del programa",
  "routines": [
    {
      "name": "nombre del día",
      "dayOfWeek": 1,
      "exercises": [
        {
          "exerciseId": "id-exacto",
          "order": 1,
          "targetSets": 3,
          "targetMinReps": 6,
          "targetMaxReps": 10,
          "targetRIR": 2,
          "restSeconds": 120,
          "method": "standard"
        }
      ]
    }
  ]
}

Asegúrate de:
- Repartir volumen equitativamente por músculo
- Incluir compound + aislamiento
- Series efectivas por músculo: 10-20/semana
- Ordenar de compound a aislamiento`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${userSummary}` },
      { role: "user", content: routinePrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  try {
    const routine = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json(routine);
  } catch {
    return NextResponse.json({ error: "Error parseando la rutina generada" }, { status: 500 });
  }
}
```

---

## Paso 6: API de Análisis Post-Sesión

### [NEW] `src/app/api/ai/analyze/route.ts`

Endpoint que se llama automáticamente al finalizar una sesión:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeSession } from "@/lib/progression";

export async function POST(request: NextRequest) {
  const { sessionId } = await request.json();

  // 1. Cargar la sesión con sus sets
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      workoutSets: { include: { exercise: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  // 2. Cargar historial por ejercicio (últimas 6 sesiones)
  // 3. Cargar RoutineExercise si la sesión tiene rutina asociada
  // 4. Ejecutar analyzeSession() del motor de reglas
  // 5. Devolver el análisis completo

  return NextResponse.json({
    progressions: [],  // ProgressionSuggestion[]
    stagnations: [],   // StagnationResult[]
    junkVolume: {},    // JunkVolumeResult
    alerts: [],        // string[]
  });
}
```

---

## Paso 7: Interfaz de Chat

### [MODIFY] `src/app/(dashboard)/ai/page.tsx` — Reemplazar el placeholder

```typescript
import { ChatInterface } from "./chat-interface";

export default function AIPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between px-1 py-2">
        <h1 className="text-lg font-bold tracking-tight">Asistente IA</h1>
      </div>
      <ChatInterface userId="default-user" />
    </div>
  );
}
```

### [NEW] `src/app/(dashboard)/ai/chat-interface.tsx`

`'use client'` — Interfaz de chat con streaming:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mensaje de bienvenida al montar
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "¡Hola! Soy tu asistente de entrenamiento. Puedo:\n\n• Analizar tu progreso y darte recomendaciones\n• Responder dudas sobre ejercicios o técnica\n• Sugerir ajustes a tu rutina\n• Generar nuevas rutinas personalizadas\n\n¿En qué te puedo ayudar?",
    }]);
  }, []);

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Añadir mensaje vacío del asistente para streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, userId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.replace("data: ", "");
          if (data === "[DONE]") break;

          try {
            const { text } = JSON.parse(data);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, content: last.content + text };
              return updated;
            });
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Error al conectar con la IA. Verifica tu API key en .env.local.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  // Auto-scroll al último mensaje
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // Layout: ScrollArea con mensajes + input fijo abajo
    // Mensajes del user: alineados a la derecha, fondo primary
    // Mensajes del assistant: alineados a la izquierda, fondo card
    // Input: fijo en la parte inferior, con botón de enviar
    // Botones rápidos sobre el input: "¿Qué entreno hoy?", "Analiza mi semana", "Genera rutina"
  );
}
```

**Quick action buttons** que se muestran encima del input:
```typescript
const quickActions = [
  { label: "¿Qué entreno hoy?", message: "¿Qué debería entrenar hoy basándote en mi historial y recuperación?" },
  { label: "Analiza mi semana", message: "Analiza mi última semana de entrenamiento: volumen, intensidad y recuperación." },
  { label: "Genera rutina", message: "Genera una rutina PPL de 4 días adaptada a mi nivel y objetivos." },
];
```

---

## Paso 8: Integrar análisis post-sesión

### [MODIFY] `src/app/(dashboard)/train/session/workout-session.tsx`

Tras el `POST /api/workouts` que guarda la sesión, añadir una llamada a:
```typescript
// Después de guardar exitosamente:
const analysisResponse = await fetch("/api/ai/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId: session.id }),
});
const analysis = await analysisResponse.json();
```

Mostrar el análisis en el **resumen post-entrenamiento** (pantalla de sessionFinished):
- Sugerencias de progresión por ejercicio (con badge ↑ ↓ →)
- Alertas de estancamiento en rojo
- % de junk volume si aplica
- Usar `Card` de Shadcn con colores según tipo de alerta

---

## Paso 9: Actualizar home con sugerencias

### [MODIFY] `src/app/(dashboard)/page.tsx`

Añadir una card con la sugerencia principal de la IA:
- Cargar la última sesión y ejecutar `analyzeSession` en Server Component
- Si hay sugerencia de progresión → mostrar "🏋️ Press banca → sube a 85kg"
- Si hay estancamiento → mostrar "⚠️ Dominadas estancadas 4 semanas"
- Enlace "Ver más en IA →" que va a `/ai`

---

## Paso 10: `.gitignore` y ROADMAP

### [MODIFY] `.gitignore`
Verificar que no se commitea la API key (`.env.local` ya está ignorado).

### [MODIFY] `docs/ROADMAP.md`
Marcar Fase 4 como completada con `[x]` en todos los items.

---

## Resumen de archivos

| Acción | Archivo | Tipo |
|--------|---------|------|
| NEW | `src/lib/progression.ts` | Utility (motor de reglas) |
| NEW | `src/lib/openai.ts` | Utility (cliente OpenAI) |
| NEW | `src/lib/ai-context.ts` | Utility (constructor de prompt) |
| NEW | `src/app/api/ai/chat/route.ts` | API Route (streaming SSE) |
| NEW | `src/app/api/ai/generate-routine/route.ts` | API Route (generación JSON) |
| NEW | `src/app/api/ai/analyze/route.ts` | API Route (análisis post-sesión) |
| NEW | `src/app/(dashboard)/ai/chat-interface.tsx` | Client Component |
| MODIFY | `src/app/(dashboard)/ai/page.tsx` | Page (reemplazar placeholder) |
| MODIFY | `src/app/(dashboard)/train/session/workout-session.tsx` | Client Component |
| MODIFY | `src/app/(dashboard)/page.tsx` | Server Component |
| MODIFY | `docs/ROADMAP.md` | Docs |

**Total: 7 archivos nuevos + 4 modificados**

---

## Verificación

1. `npx next build` compila sin errores
2. Con PostgreSQL y `OPENAI_API_KEY` configurada en `.env.local`:
   - `/ai` muestra interfaz de chat con mensaje de bienvenida
   - Escribir un mensaje → respuesta en streaming (palabra por palabra)
   - Quick actions funcionan ("¿Qué entreno hoy?", "Analiza mi semana")
   - "Genera rutina" → devuelve rutina estructurada en JSON
3. Al finalizar una sesión:
   - Se muestra análisis post-sesión con sugerencias
   - Progresión: "Press banca → sube a 85kg" / "Mantén" / "Baja peso"
   - Estancamiento detectado si aplica
   - % de junk volume mostrado
4. Home (`/`) muestra la sugerencia principal de la IA
5. Chat funciona sin API key → muestra error amigable
6. Responsive a 390px de ancho. Chat ocupa toda la altura disponible.

---

## Reglas importantes

- **Commits en primera persona** → `feat(ai): implemento chat contextual con streaming SSE`
- **Server Components** para queries de Prisma. `'use client'` SOLO para:
  - `chat-interface.tsx` (estado del chat + streaming)
- **`force-dynamic`** en páginas que hagan queries
- **Mobile-first** — 390px de ancho. El chat debe usar toda la altura.
- **Streaming SSE con ReadableStream** — No usar `res.write()` (no funciona en App Router)
- **NO crear tests** en esta fase
- **NO persistir mensajes** del chat (en memoria, se pierden al navegar)
- **Manejo de errores**: si no hay `OPENAI_API_KEY` → mostrar mensaje amigable, no crashear
- **Temperatura 0.7** para chat, **0.5** para generación de rutinas (más determinístico)
- **JSON mode** (`response_format: { type: "json_object" }`) para generación de rutinas
- **Max tokens 1500** para respuestas del chat (evitar respuestas excesivas)
