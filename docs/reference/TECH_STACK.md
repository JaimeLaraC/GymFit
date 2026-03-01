# 🛠️ Stack Tecnológico — GymFit

> **Tipo de documento:** Reference (Diataxis)
> Descripción factual de cada tecnología elegida y su justificación.

---

## Stack Completo

| Categoría | Tecnología | Versión | Justificación |
|-----------|-----------|---------|---------------|
| **Framework** | Next.js (App Router) | 15.x | SSR/SSG, API routes integradas, Server Components, optimizaciones de imagen |
| **Lenguaje** | TypeScript | 5.x | Type safety, mejor DX, detección de errores en compilación |
| **Runtime** | Node.js | 20+ | LTS, soporte nativo ESM, performance improvements |
| **UI Framework** | React | 19.x | Server Components, Suspense, streaming, ecosistema maduro |
| **Componentes** | Shadcn UI + Radix UI | latest | Componentes accesibles, personalizables, sin lock-in |
| **Estilos** | Tailwind CSS | 4.x | Utility-first, mobile-first, rapid prototyping, tree-shaking |
| **ORM** | Prisma | 6.x | Type-safe queries, migrations declarativas, schema como fuente de verdad |
| **Base de datos** | PostgreSQL | 15+ | Robusta, relacional, soporte JSON/JSONB, índices avanzados |
| **IA - Chat** | OpenAI GPT-5.2 | API | Chat contextual, entrenador personal, análisis multivariable |
| **IA - Vision** | OpenAI GPT-5.2 (Vision) | API | Análisis de fotos (nutrición, progreso corporal) |
| **Gráficas** | Recharts | latest | Gráficas reactivas basadas en React, fácil personalización |
| **PWA** | next-pwa / Workbox | latest | Service worker, precaching, background sync |
| **Testing (Unit)** | Vitest | latest | Compatible con Vite/Next.js, rápido, API similar a Jest |
| **Testing (E2E)** | Playwright | latest | Cross-browser, mobile emulation, reliable |
| **Linting** | ESLint + Prettier | latest | Código consistente, detección de errores |
| **Deploy** | VPS propio / Vercel | — | HTTPS obligatorio para PWA, Vercel como opción serverless |

---

## Dependencias Clave

### Producción
```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.0.0",
  "@prisma/client": "^6.0.0",
  "openai": "^5.0.0",
  "recharts": "^2.0.0",
  "tailwindcss": "^4.0.0",
  "@radix-ui/react-*": "latest",
  "next-pwa": "latest",
  "zod": "^3.0.0",
  "date-fns": "^3.0.0"
}
```

### Desarrollo
```json
{
  "prisma": "^6.0.0",
  "vitest": "latest",
  "@playwright/test": "latest",
  "eslint": "latest",
  "prettier": "latest",
  "@types/node": "^20.0.0",
  "@types/react": "^19.0.0"
}
```

---

## Requisitos Mínimos

| Requisito | Valor |
|-----------|-------|
| Node.js | 20+ |
| PostgreSQL | 15+ |
| npm | 10+ |
| Sistema operativo servidor | Linux (Ubuntu 22.04+) |
| Navegador (cliente) | Safari iOS 16+, Chrome 100+, Firefox 100+ |
| HTTPS | Obligatorio (Let's Encrypt o similar) |

---

## Decisiones Técnicas Clave

### ¿Por qué Next.js y no Vite?
- API Routes integradas → no necesito backend separado
- Server Components → menos JavaScript en cliente (mejor para PWA en iPhone)
- Optimización automática de imágenes
- SSR para SEO si algún día se necesita

### ¿Por qué PostgreSQL y no SQLite?
- Soporte de JSON/JSONB para datos flexibles (preferencias, configuraciones IA)
- Índices parciales y compuestos más potentes
- Mejor para queries analíticas (métricas, tendencias)
- Compatible con Vercel Postgres si se despliega ahí

### ¿Por qué Prisma y no Drizzle?
- Esquema declarativo más legible
- Migraciones automáticas
- Prisma Studio para inspeccionar datos durante desarrollo
- Ecosistema más maduro

### ¿Por qué OpenAI GPT-5.2?
- Modelo más avanzado disponible con capacidades multimodales
- Vision API integrada (análisis de fotos)
- Streaming nativo para chat en tiempo real
- API bien documentada con SDK oficial para Node.js

### ¿Por qué Shadcn UI?
- No es una librería, es código que copias → control total
- Basado en Radix UI (accesible y testeado)
- Personalizable con Tailwind sin override de estilos
- Componentes como Dialog, Select, Toast ya resueltos
