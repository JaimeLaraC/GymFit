# 🧪 Estrategia de Testing — GymFit

> Plan de testing para asegurar la calidad del código.

---

## Herramientas

| Herramienta | Propósito |
|------------|-----------|
| **Vitest** | Unit tests y tests de integración |
| **Playwright** | Tests end-to-end (E2E) |
| **@testing-library/react** | Testing de componentes React |
| **MSW** (Mock Service Worker) | Mock de APIs externas (OpenAI) |

---

## Pirámide de Testing

```
        ┌────────┐
        │  E2E   │  ← Pocos, lentos, flujos críticos
       ┌┴────────┴┐
       │Integration│  ← API routes, server actions, servicios
      ┌┴──────────┴┐
      │   Unit      │  ← Muchos, rápidos, lógica de negocio
      └─────────────┘
```

---

## Unit Tests (Vitest)

### Qué testear
- Reglas de progresión (`calculateProgression`)
- Cálculo de score global (`calculateGlobalScore`)
- Cálculo de e1RM (`calculateE1RM`)
- Detección de series efectivas (`isEffectiveSet`)
- Detección de junk volume
- Parsing y validación de Recovery Snapshots
- Fallback de métricas (media 7 días)
- Validación con Zod schemas

### Ejemplo

```typescript
import { describe, it, expect } from "vitest";
import { calculateProgression } from "@/lib/rules/progression";

describe("calculateProgression", () => {
  it("sugiere subir peso cuando se alcanza el rango alto con RIR objetivo", () => {
    const result = calculateProgression({
      lastSets: [
        { reps: 10, rir: 2 },
        { reps: 10, rir: 2 },
        { reps: 9, rir: 3 },
      ],
      repRange: { min: 6, max: 10 },
      targetRIR: 2,
      currentWeight: 80,
    });

    expect(result.action).toBe("increase_weight");
    expect(result.newWeight).toBe(82.5);
  });

  it("mantiene peso si no se alcanza el rango alto", () => {
    const result = calculateProgression({
      lastSets: [
        { reps: 7, rir: 2 },
        { reps: 6, rir: 3 },
        { reps: 6, rir: 3 },
      ],
      repRange: { min: 6, max: 10 },
      targetRIR: 2,
      currentWeight: 80,
    });

    expect(result.action).toBe("maintain");
  });
});
```

### Cobertura objetivo
- **>80%** en `lib/rules/` y `lib/services/`
- **>60%** en componentes con lógica
- No se exige cobertura en layouts/styles

---

## Tests de Integración

### Qué testear
- API Route `/api/recovery` (POST con token válido/inválido)
- API Route `/api/workouts` (CRUD completo)
- Server Actions de formularios
- Servicios que combinan Prisma + lógica

### Ejemplo

```typescript
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/recovery/route";

describe("POST /api/recovery", () => {
  it("guarda un snapshot válido", async () => {
    const request = new Request("http://localhost/api/recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        date: "2026-03-01",
        resting_hr_bpm: 58,
        sleep_hours: 7.5,
        steps: 8432,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("rechaza petición sin token", async () => {
    const request = new Request("http://localhost/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-03-01" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

---

## Tests E2E (Playwright)

### Flujos críticos
1. **Registrar un entrenamiento completo** (seleccionar rutina → registrar series → finalizar)
2. **Consultar progreso** (ver score, gráficas, historial)
3. **Chat con IA** (enviar mensaje → recibir respuesta)
4. **Instalar la PWA** (verificar manifest y service worker)

### Configuración

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 390, height: 844 }, // iPhone 14
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
  },
});
```

---

## Datos de Prueba

Fixtures predefinidos con datos realistas:

- **Ejercicios**: 30 ejercicios con clasificación completa
- **Sesiones**: 4 semanas de historial simulado
- **Recovery Snapshots**: 30 días de métricas fisiológicas
- **Body Metrics**: Medidas corporales mensuales
- **Meals**: Comidas tipo con macros

---

## Ejecución

```bash
# Unit + Integration
npm run test

# Unit + Integration con cobertura
npm run test:coverage

# E2E
npm run test:e2e

# E2E con UI de Playwright
npm run test:e2e:ui
```
