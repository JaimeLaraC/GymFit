# 📐 Estándares de Código — GymFit

> Convenciones de desarrollo basadas en las skills `nextjs-react-typescript` y `git-workflow`.

---

## TypeScript

- **TypeScript estricto** (`strict: true` en tsconfig)
- Preferir **interfaces** sobre types para objetos
- **No usar enums**, usar maps constantes en su lugar
- Todos los componentes y funciones tipados explícitamente
- Usar `unknown` en lugar de `any` siempre que sea posible

```typescript
// ✅ Bien
interface WorkoutSet {
  id: string;
  reps: number;
  weight: number;
  rir: number;
  isEffective: boolean;
}

// ✅ Bien — Map en lugar de enum
const MUSCLE_GROUPS = {
  chest: "Pecho",
  back: "Espalda",
  quads: "Cuádriceps",
  hamstrings: "Isquiotibiales",
} as const;

type MuscleGroup = keyof typeof MUSCLE_GROUPS;

// ❌ Mal — Evitar enums
enum MuscleGroup {
  Chest,
  Back,
}
```

---

## React / Next.js

### Server Components por defecto
- Solo añadir `'use client'` cuando se necesite interactividad del navegador
- Mover `'use client'` al componente más pequeño posible

### Patrón funcional
- **No usar clases**. Solo functional components y hooks
- Preferir composición sobre herencia

### Organización de archivos

```typescript
// Orden dentro de un archivo de componente:
// 1. Imports
// 2. Interfaces/Types
// 3. Componente exportado
// 4. Sub-componentes (si aplica)
// 5. Helpers/utils locales
// 6. Constantes
```

### Naming

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Directorios | kebab-case | `workout-logger/` |
| Componentes | PascalCase | `WorkoutLogger.tsx` |
| Hooks | camelCase con `use` | `useWorkoutSession.ts` |
| Utils/helpers | camelCase | `calculateE1rm.ts` |
| Tipos/interfaces | PascalCase | `WorkoutSession` |
| Variables | camelCase con verbos auxiliares | `isLoading`, `hasError`, `canSubmit` |
| Constantes | UPPER_SNAKE_CASE | `MAX_SETS_PER_EXERCISE` |

### Exports
- Favorecer **named exports** sobre default exports
- Excepción: páginas de Next.js (`page.tsx`, `layout.tsx`) usan default

---

## Estado y Data Fetching

- **Server Components** para data fetching (acceso directo a Prisma)
- **Server Actions** para mutaciones (formularios)
- `'use client'` solo para: formularios interactivos, timers, cámara, chat streaming
- Minimizar `useEffect` y `useState` — favorecer RSC
- Wrap client components en `<Suspense>` con fallback

---

## Estilos (Tailwind)

- **Mobile-first**: escribir las clases base para móvil, usar `md:` y `lg:` para pantallas grandes
- No usar estilos inline (`style={{}}`) excepto para valores dinámicos
- Agrupar clases con `cn()` (clsx + tailwind-merge) de Shadcn
- No duplicar clases — extraer a componentes reutilizables

---

## Git Workflow

### Conventional Commits

```
<tipo>(<ámbito>): <descripción en primera persona>

<cuerpo opcional>
```

**Tipos:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Documentación
- `refactor`: Reestructuración sin cambiar funcionalidad
- `perf`: Mejora de rendimiento
- `test`: Añadir o modificar tests
- `chore`: Tareas de build, tooling, dependencias

**Ejemplos:**
```bash
feat(workout): implemento el logging de series con autocompletado
fix(ai): corrijo el streaming del chat que se cortaba en respuestas largas
docs(api): actualizo la referencia del endpoint de recovery
refactor(progress): extraigo el cálculo del score a un servicio separado
```

> **Regla:** Los commits siempre en primera persona, como si los escribieras tú.

### Branching Strategy (Git-Flow)

```
main ← releases etiquetadas (v1.0.0, v1.1.0...)
  └── develop ← integración continua
        ├── feature/workout-logger
        ├── feature/ai-chat
        └── feature/pwa-setup
```

### Commits atómicos
- Un commit = un cambio lógico
- No mezclar features con fixes
- Commit frecuente, push al final del día

---

## Error Handling

```typescript
// Errores tipados
class GymFitError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

class NotFoundError extends GymFitError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, "NOT_FOUND", 404);
  }
}

class UnauthorizedError extends GymFitError {
  constructor() {
    super("Token inválido o ausente", "UNAUTHORIZED", 401);
  }
}
```

---

## Validación

Usar **Zod** para validar inputs en API routes y Server Actions:

```typescript
import { z } from "zod";

const recoverySnapshotSchema = z.object({
  date: z.string().date(),
  resting_hr_bpm: z.number().int().min(30).max(200),
  sleep_hours: z.number().min(0).max(24),
  hrv_ms: z.number().nullable(),
  subjective_energy: z.number().int().min(1).max(10).nullable(),
});
```
