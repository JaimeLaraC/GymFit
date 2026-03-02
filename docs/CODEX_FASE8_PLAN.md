# Plan de Implementación — Fase 8: PWA + Testing + Deploy

> Este documento está diseñado para que **Codex** lo ejecute de forma autónoma.
> Sigue cada paso en orden, consulta las skills antes de codificar, y commitea con el formato indicado.
> Esta es la **fase final** del proyecto. Al terminar, se tagea como **v1.0.0**.

---

## Documentación de referencia OBLIGATORIA

1. **`.agents/skills/pwa-development/SKILL.md`** — Service Worker, caching strategies, Background Sync, install prompt, offline, Workbox, Lighthouse
2. **`.agents/skills/nextjs-react-typescript/SKILL.md`** — Optimize Web Vitals (LCP, CLS, FID), testing patterns
3. **`.agents/skills/git-workflow/SKILL.md`** — Tags, releases, Conventional Commits
4. **`docs/how-to/DEPLOYMENT.md`** — Guía de deploy (Vercel + VPS)

**Lee las 4 referencias ANTES de escribir código.**

---

## Contexto del Proyecto

### Stack
- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn UI · Prisma 6 · PostgreSQL · Recharts · OpenAI SDK

### PWA actual (Fase 0)
| Archivo | Estado |
|---------|--------|
| `public/manifest.json` | ✅ Existe (verificar campos) |
| `public/sw.js` | ✅ Existe (básico, necesita optimizar) |
| `public/offline.html` | ✅ Existe |
| `src/app/layout.tsx` | ✅ Registra SW, meta tags PWA |

### Archivos clave a verificar/modificar
| Archivo | Propósito |
|---------|-----------|
| `src/lib/calculations.ts` | Funciones puras → tests unitarios |
| `src/lib/score.ts` | Funciones puras → tests unitarios |
| `src/lib/smoothing.ts` | EMA → tests unitarios |
| `src/lib/nutrition-targets.ts` | Funciones puras → tests unitarios |
| `src/lib/gamification.ts` | Streak/badges → tests unitarios |
| `src/lib/progression.ts` | Motor de reglas → tests unitarios |
| `src/lib/recovery-fallback.ts` | Fallback → tests con mocks |

---

## Reglas de las skills aplicadas

### Skill: `pwa-development`
- **Service Worker completo** con estrategias por tipo de recurso:
  - **Cache First** → assets estáticos (CSS, JS, fonts, imágenes)
  - **Network First** → API responses (`/api/*`)
  - **Stale While Revalidate** → páginas HTML
- **Precaching** de assets críticos en install
- **Background Sync** → POST de sesiones y comidas cuando offline
- **Install prompt** personalizado
- **Offline detection** → banner "Sin conexión" en el layout
- **Manifest completo** con shortcuts, screenshots, maskable icons

### Skill: `nextjs-react-typescript`
- **Optimize Web Vitals**: LCP < 2.5s, CLS < 0.1, FID < 100ms
- **Preload** fuentes críticas
- **Image optimization**: WebP, lazy loading, size data

### Skill: `git-workflow`
- **Tag v1.0.0** con annotated tag
- **Conventional Commits**

---

## Git: Branch y commits

```bash
git checkout develop && git pull origin develop
git checkout -b feature/pwa-polish
```

### Commits (en orden):
```bash
# 1
git commit -m "feat(pwa): optimizo Service Worker con estrategias de caching

Cache First para assets estáticos, Network First para API,
Stale While Revalidate para navegación. Precaching de rutas
críticas en install. Background Sync para POST offline."

# 2
git commit -m "feat(pwa): implemento Background Sync para registro offline

Las sesiones y comidas registradas sin conexión se encolan
y se envían automáticamente al recuperar conexión.
Añado banner de estado offline en el layout."

# 3
git commit -m "feat(pwa): optimizo manifest, iconos y install prompt

Manifest completo con shortcuts a /train y /nutrition.
Iconos maskable. Install prompt personalizado."

# 4
git commit -m "test(lib): implemento tests unitarios para lógica de negocio

Tests para calculations, score, smoothing, nutrition-targets,
progression y gamification. Cobertura >80% en src/lib/."

# 5
git commit -m "test(e2e): implemento tests E2E para flujos críticos

Tests con Playwright: login → crear sesión → ver historial →
ver progreso → chat IA."

# 6
git commit -m "perf(vitals): optimizo Web Vitals para Lighthouse 90+

Preload fonts, optimizo imágenes, elimino layout shifts,
defer non-critical JS. Target: PWA badge + 90+ performance."

# 7
git commit -m "docs(roadmap): marco la Fase 8 como completada"
```

### Al finalizar:
```bash
git checkout develop
git merge --no-ff feature/pwa-polish -m "merge: integro PWA, tests y optimizaciones en develop"

# Merge develop → main para release
git checkout main
git merge --no-ff develop -m "merge: release v1.0.0 — all 8 phases completed"

# Tag de release
git tag -a v1.0.0 -m "Release v1.0.0

GymFit — Smart Gym Training PWA
Funcionalidades completas:
- Workout logging con series, reps, peso, RIR
- Historial y métricas con gráficas (Recharts)
- Score global 0-100 con 4 dimensiones
- Fotos de progreso y métricas corporales
- Motor de IA (GPT) con chat streaming y generación de rutinas
- Apple Watch recovery via iOS Shortcuts
- Nutrición con análisis de foto (GPT Vision)
- Gamificación con rachas, PRs y badges
- PWA optimizada: offline, install, Background Sync
- Tests unitarios (>80%) y E2E"

git push origin main
git push origin develop
git push origin feature/pwa-polish
git push origin v1.0.0
```

---

## Paso 1: Instalar dependencias de testing

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
npx playwright install chromium
```

Añadir scripts a `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## Paso 2: Configurar Vitest

### [NEW] `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/prisma.ts"],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## Paso 3: Tests unitarios

### [NEW] `src/lib/__tests__/calculations.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateE1RM, calculateVolume, countEffectiveSets, detectPRs } from "../calculations";

describe("calculateE1RM", () => {
  it("devuelve el peso directo para 1 rep", () => {
    expect(calculateE1RM(100, 1)).toBe(100);
  });

  it("calcula e1RM correctamente para 5 reps", () => {
    const result = calculateE1RM(100, 5);
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(120);
  });

  it("devuelve 0 para 0 reps", () => {
    expect(calculateE1RM(100, 0)).toBe(0);
  });

  it("cap a peso real para ≥37 reps", () => {
    expect(calculateE1RM(50, 40)).toBe(50);
  });
});

describe("calculateVolume", () => {
  it("suma peso × reps de todos los sets", () => {
    expect(calculateVolume([
      { weight: 100, reps: 10 },
      { weight: 80, reps: 12 },
    ])).toBe(1960);
  });

  it("devuelve 0 para array vacío", () => {
    expect(calculateVolume([])).toBe(0);
  });
});

describe("countEffectiveSets", () => {
  it("cuenta sets con RIR ≤ 3", () => {
    expect(countEffectiveSets([
      { rir: 2 }, { rir: 3 }, { rir: 4 }, { rir: null },
    ])).toBe(2);
  });
});

describe("detectPRs", () => {
  it("detecta PR de peso cuando es mayor que el histórico", () => {
    const prs = detectPRs(
      [{ weight: 110, reps: 5, rir: 2 }],
      [{ weight: 100, reps: 5 }],
      "Press banca",
      new Date()
    );
    expect(prs.some((p) => p.type === "weight")).toBe(true);
  });

  it("no detecta PR si es menor o igual", () => {
    const prs = detectPRs(
      [{ weight: 90, reps: 5, rir: 2 }],
      [{ weight: 100, reps: 5 }],
      "Press banca",
      new Date()
    );
    expect(prs.some((p) => p.type === "weight")).toBe(false);
  });

  it("devuelve array vacío si no hay sets actuales", () => {
    expect(detectPRs([], [], "Test", new Date())).toEqual([]);
  });
});
```

### [NEW] `src/lib/__tests__/score.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateScore } from "../score";

// Tests para cada dimensión del score y el total
// Verificar que el score está entre 0-100
// Verificar tendencia (up, stable, down)
```

### [NEW] `src/lib/__tests__/smoothing.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateEMA } from "../smoothing";

describe("calculateEMA", () => {
  it("devuelve el primer valor como inicio", () => {
    expect(calculateEMA([80])).toEqual([80]);
  });

  it("suaviza una serie de valores", () => {
    const result = calculateEMA([80, 81, 79, 80, 82], 0.1);
    // Todos los valores deben estar entre 79 y 82
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(79);
      expect(v).toBeLessThanOrEqual(82);
    });
  });

  it("ignora valores null", () => {
    const result = calculateEMA([80, null, 82], 0.1);
    expect(result).toHaveLength(2);
  });
});
```

### [NEW] `src/lib/__tests__/nutrition-targets.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateTargets } from "../nutrition-targets";

describe("calculateTargets", () => {
  it("calcula superávit para hypertrophy", () => {
    const t = calculateTargets(75, "hypertrophy");
    expect(t.calories).toBe(2625); // 75 × 35
    expect(t.proteinG).toBe(150);   // 75 × 2.0
  });

  it("calcula déficit para definition", () => {
    const t = calculateTargets(80, "definition");
    expect(t.calories).toBe(2000); // 80 × 25
    expect(t.proteinG).toBe(176);   // 80 × 2.2
  });

  it("proteína más alta en déficit que en volumen", () => {
    const volume = calculateTargets(75, "hypertrophy");
    const cut = calculateTargets(75, "definition");
    expect(cut.proteinG).toBeGreaterThan(volume.proteinG);
  });
});
```

### [NEW] `src/lib/__tests__/progression.test.ts`

```typescript
// Tests para evaluateDoubleProgression:
// - Sube peso cuando todas series en rango alto + RIR ≤ objetivo+1
// - Baja peso cuando 2+ sesiones sin alcanzar rango mínimo
// - Mantiene peso en caso normal
// Tests para detectStagnation
// Tests para detectJunkVolume
```

---

## Paso 4: Configurar Playwright (E2E)

### [NEW] `playwright.config.ts`

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 390, height: 844 }, // iPhone 14
    locale: "es-ES",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

### [NEW] `tests/e2e/navigation.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Navegación principal", () => {
  test("carga el home con score card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("GymFit");
  });

  test("navega a Train hub", async ({ page }) => {
    await page.goto("/");
    await page.click('[href="/train"]');
    await expect(page).toHaveURL("/train");
  });

  test("navega a ejercicios y muestra lista", async ({ page }) => {
    await page.goto("/train/exercises");
    await expect(page.locator("h1")).toContainText("Ejercicios");
  });

  test("navega a progreso con tabs", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.locator('[role="tablist"]')).toBeVisible();
  });

  test("navega a nutrición", async ({ page }) => {
    await page.goto("/nutrition");
    await expect(page.locator("h1")).toContainText("Nutrición");
  });

  test("navega al chat IA", async ({ page }) => {
    await page.goto("/ai");
    await expect(page.locator("h1")).toContainText("Asistente");
  });
});
```

### [NEW] `tests/e2e/workout-flow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Flujo de entrenamiento", () => {
  test("puede iniciar una sesión y registrar un set", async ({ page }) => {
    await page.goto("/train/session/new");
    // Seleccionar ejercicio
    // Rellenar peso, reps, RIR
    // Completar set
    // Verificar que el set aparece en la lista
  });
});
```

---

## Paso 5: Optimizar Service Worker

### [MODIFY] `public/sw.js`

Reescribir con estrategias de caching del skill `pwa-development`:

```javascript
const CACHE_NAME = "gymfit-v1";
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
];

// INSTALL: Precache assets críticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: Limpiar caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: Estrategias por tipo de recurso
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests y requests a otros dominios
  if (event.request.method !== "GET" || !url.origin === location.origin) return;

  // API: Network First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Imágenes y assets: Cache First
  if (
    event.request.destination === "image" ||
    event.request.destination === "style" ||
    event.request.destination === "script" ||
    event.request.destination === "font"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Navegación: Stale While Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached || caches.match("/offline.html"));
        return cached || fetchPromise;
      })
    )
  );
});

// BACKGROUND SYNC: Cola de POST offline
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-workouts") {
    event.waitUntil(replayQueuedRequests("workout-queue"));
  }
  if (event.tag === "sync-meals") {
    event.waitUntil(replayQueuedRequests("meal-queue"));
  }
});

async function replayQueuedRequests(queueName) {
  const db = await openDB();
  const tx = db.transaction(queueName, "readonly");
  const store = tx.objectStore(queueName);
  const requests = await store.getAll();

  for (const req of requests) {
    try {
      await fetch(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      // Eliminar de la cola si éxito
      const deleteTx = db.transaction(queueName, "readwrite");
      deleteTx.objectStore(queueName).delete(req.id);
    } catch {
      // Dejar en la cola para reintentar
    }
  }
}
```

---

## Paso 6: Background Sync helper

### [NEW] `src/lib/offline-queue.ts`

```typescript
"use client";

// Helper para encolar POST cuando offline
export async function queueOfflineRequest(
  queueName: string,
  url: string,
  body: unknown
): Promise<void> {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    // Guardar en IndexedDB
    const db = await openDB();
    const tx = db.transaction(queueName, "readwrite");
    tx.objectStore(queueName).add({ url, body, timestamp: Date.now() });

    // Registrar sync
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(`sync-${queueName.replace("-queue", "")}s`);
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("gymfit-offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("workout-queue")) {
        db.createObjectStore("workout-queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meal-queue")) {
        db.createObjectStore("meal-queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

---

## Paso 7: Banner offline en layout

### [NEW] `src/components/offline-banner.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";

// Skill: nextjs-react-typescript → minimize useState
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function update() { setIsOffline(!navigator.onLine); }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-orange-500 text-white text-center text-xs py-1 px-4">
      📡 Sin conexión — Los datos se sincronizarán automáticamente
    </div>
  );
}
```

### [MODIFY] `src/app/(dashboard)/layout.tsx`

Añadir `<OfflineBanner />` al top del layout, antes del `{children}`.

---

## Paso 8: Optimizar Manifest y Install Prompt

### [MODIFY] `public/manifest.json`

Verificar y completar con campos del skill `pwa-development`:

```json
{
  "name": "GymFit — Smart Gym Training",
  "short_name": "GymFit",
  "description": "Tu entrenador personal inteligente. Registro de entrenos, métricas, nutrición e IA.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "lang": "es",
  "categories": ["health", "fitness"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Nueva Sesión",
      "short_name": "Entrenar",
      "url": "/train/session/new?source=shortcut",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Registrar Comida",
      "short_name": "Nutrición",
      "url": "/nutrition/add-photo?source=shortcut",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
```

> **NOTA:** Si no existen los iconos en `public/icons/`, crear PNG de 192×192 y 512×512.
> Usar un generador online o un color sólido con las iniciales "GF" como placeholder.

---

## Paso 9: Optimizar Web Vitals

### [MODIFY] `src/app/layout.tsx`

```typescript
// Preload fuente crítica
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="" />

// Si las fuentes son de Google Fonts y ya se cargan vía next/font, verificar que
// next/font genera el preload automáticamente. Si no, añadir manualmente.
```

### Verificar en todo el proyecto:
- No hay layout shifts (CLS) → todos los containers tienen height/min-height definido
- No hay imágenes sin width/height (las fotos de comida/progreso deben tener tamaño fijo)
- Las gráficas Recharts están en containers con height fijo (200-300px)

---

## Paso 10: Deploy y Release

### [MODIFY] `docs/ROADMAP.md`

Marcar Fase 8: `[x]` en todos los items.

### Verificación final

Ejecutar en este orden:

```bash
# 1. Tests unitarios con cobertura
npm run test:coverage
# Verificar: >80% en src/lib/

# 2. Build de producción
npx next build
# Verificar: 0 errores

# 3. Tests E2E (con servidor corriendo)
npm run test:e2e
# Verificar: todos los tests pasan

# 4. Lighthouse audit (usar Chrome DevTools o CLI)
npx lighthouse http://localhost:3000 --view
# Verificar: PWA badge ✅, Performance ≥ 90

# 5. Verificar en viewport 390px (Chrome DevTools → iPhone 14)
# - Todas las páginas renderizan correctamente
# - BottomNav visible y funcional
# - Gráficas responsivas
# - Formularios accesibles (teclado numérico)

# 6. Verificar offline
# - Activar modo avión en DevTools
# - La app carga (Stale While Revalidate)
# - Se muestra el banner offline
# - Se puede registrar sesión/comida (se encola)
# - Al reconectar, se sincroniza
```

---

## Resumen de archivos

| Acción | Archivo | Tipo | Skill |
|--------|---------|------|-------|
| NEW | `vitest.config.ts` | Config | — |
| NEW | `playwright.config.ts` | Config | — |
| NEW | `src/lib/__tests__/calculations.test.ts` | Test | Vitest |
| NEW | `src/lib/__tests__/score.test.ts` | Test | Vitest |
| NEW | `src/lib/__tests__/smoothing.test.ts` | Test | Vitest |
| NEW | `src/lib/__tests__/nutrition-targets.test.ts` | Test | Vitest |
| NEW | `src/lib/__tests__/progression.test.ts` | Test | Vitest |
| NEW | `tests/e2e/navigation.spec.ts` | E2E | Playwright |
| NEW | `tests/e2e/workout-flow.spec.ts` | E2E | Playwright |
| NEW | `src/lib/offline-queue.ts` | Utility | PWA Background Sync |
| NEW | `src/components/offline-banner.tsx` | Client Component | PWA offline detection |
| MODIFY | `public/sw.js` | Service Worker | Cache First + Network First + SWR |
| MODIFY | `public/manifest.json` | PWA Manifest | Shortcuts, maskable |
| MODIFY | `src/app/(dashboard)/layout.tsx` | Layout | Offline banner |
| MODIFY | `src/app/layout.tsx` | Root layout | Preload fonts |
| MODIFY | `package.json` | Scripts | test, test:e2e, test:coverage |
| MODIFY | `docs/ROADMAP.md` | Docs | All phases complete |

**Total: 11 nuevos + 6 modificados**

---

## Verificación final

| Check | Criterio | Cómo verificar |
|-------|----------|----------------|
| Build | 0 errores | `npx next build` |
| Tests unitarios | >80% cobertura en `src/lib/` | `npm run test:coverage` |
| Tests E2E | Todos pasan | `npm run test:e2e` |
| Lighthouse PWA | Badge PWA ✅ | Chrome DevTools → Lighthouse |
| Lighthouse Performance | ≥ 90 | Chrome DevTools → Lighthouse |
| Offline | App carga, banner visible | DevTools → Network → Offline |
| Background Sync | POST se reenvía | Registrar offline → reconectar |
| Install | Se puede instalar | Safari → Compartir → Añadir inicio |
| Responsive | 390px funcional | DevTools → iPhone 14 |
| Tag | v1.0.0 creado | `git tag -l` |
