# 🏗️ Arquitectura Técnica — GymFit

> **Tipo de documento:** Reference (Diataxis)
> Descripción factual de la arquitectura del sistema.

---

## Patrón Arquitectónico

GymFit utiliza **Next.js 15 con App Router**, combinando Server Components y Client Components según la necesidad de cada vista. La arquitectura sigue un modelo por capas:

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  React Server Components + Client Components (Shadcn)   │
├─────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                     │
│  Server Actions / API Routes / Service Functions         │
├─────────────────────────────────────────────────────────┤
│                     DOMAIN LAYER                         │
│  Business Logic / AI Rules Engine / Progression Rules    │
├─────────────────────────────────────────────────────────┤
│                      DATA LAYER                          │
│  Prisma ORM / OpenAI Client / Apple Watch Receiver       │
├─────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                        │
│  PostgreSQL / OpenAI GPT-5.2 API / Service Worker (PWA)  │
└─────────────────────────────────────────────────────────┘
```

---

## Diagrama de Módulos

```mermaid
graph TB
    subgraph Presentation["Capa de Presentación"]
        UI_Train["🏋️ Entrenamiento"]
        UI_Progress["📊 Progreso"]
        UI_AI["🤖 Asistente IA"]
        UI_Nutrition["🍽️ Nutrición"]
        UI_Gamification["🎮 Gamificación"]
    end

    subgraph Application["Capa de Aplicación"]
        SA_Workout["Server Actions: Workout"]
        SA_Progress["Server Actions: Progress"]
        SA_AI["API Route: AI Chat"]
        SA_Nutrition["API Route: Nutrition"]
        SA_Recovery["API Route: Recovery"]
    end

    subgraph Domain["Capa de Dominio"]
        SVC_Progression["Progression Engine"]
        SVC_Score["Score Calculator"]
        SVC_Rules["Rules Engine"]
        SVC_Analysis["Analysis Service"]
    end

    subgraph Data["Capa de Datos"]
        Prisma["Prisma ORM"]
        OpenAI["OpenAI GPT-5.2"]
        SW["Service Worker"]
    end

    subgraph Infra["Infraestructura"]
        DB[(PostgreSQL)]
        GPT["GPT-5.2 API"]
        Watch["Apple Watch via Shortcuts"]
    end

    UI_Train --> SA_Workout
    UI_Progress --> SA_Progress
    UI_AI --> SA_AI
    UI_Nutrition --> SA_Nutrition
    Watch --> SA_Recovery

    SA_Workout --> SVC_Progression
    SA_Progress --> SVC_Score
    SA_AI --> SVC_Rules
    SA_AI --> SVC_Analysis
    SA_Nutrition --> OpenAI
    SA_Recovery --> SVC_Score

    SVC_Progression --> Prisma
    SVC_Score --> Prisma
    SVC_Rules --> OpenAI
    SVC_Analysis --> Prisma

    Prisma --> DB
    OpenAI --> GPT
    SW -.-> DB
```

---

## Flujo de Datos

### Server Components (por defecto)
- Páginas de dashboard, historial, gráficas
- Acceso directo a Prisma sin API intermedia
- Renderizado en servidor, menor JS en cliente

### Client Components (`'use client'`)
- Formulario de logging de entreno (interactividad en tiempo real)
- Chat con IA (streaming de respuestas)
- Temporizador de descansos
- Cámara para fotos (nutrición/progreso)

### API Routes (`/api/*`)
- `POST /api/recovery` — Receptor de datos de Apple Watch (Shortcuts)
- `POST /api/ai/chat` — Chat con GPT-5.2 (streaming)
- `POST /api/ai/nutrition` — Análisis de foto de comida
- `POST /api/ai/generate-routine` — Generación de rutinas

---

## PWA Architecture

```mermaid
graph LR
    subgraph Client["Navegador (iPhone Safari)"]
        App["Next.js App"]
        SW["Service Worker"]
        Cache["Cache Storage"]
        IDB["IndexedDB"]
    end

    subgraph Server["Servidor"]
        NextServer["Next.js Server"]
        DB[(PostgreSQL)]
    end

    App -->|"fetch"| SW
    SW -->|"cache first"| Cache
    SW -->|"network first"| NextServer
    NextServer --> DB
    App -->|"offline queue"| IDB
    IDB -->|"background sync"| NextServer
```

**Estrategia de caching:**
| Recurso | Estrategia | Razón |
|---------|-----------|-------|
| HTML/CSS/JS estáticos | Cache First | Raramente cambian, carga instantánea |
| API de datos (entrenos, métricas) | Network First | Datos frescos prioritarios, cache como fallback |
| Imágenes (ejercicios) | Cache First | Assets estáticos, 30 días |
| API de IA | Network Only | Requiere conexión, no cacheable |

---

## Estructura de Directorios (código fuente)

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Route group: vistas principales
│   │   ├── train/                # Módulo de entrenamiento
│   │   ├── progress/             # Módulo de progreso
│   │   ├── ai/                   # Asistente IA
│   │   ├── nutrition/            # Nutrición
│   │   └── profile/              # Perfil y gamificación
│   ├── api/                      # API Routes
│   │   ├── recovery/             # Endpoint Apple Watch
│   │   ├── ai/                   # Endpoints de IA
│   │   └── [...]/                # Resto de endpoints
│   ├── layout.tsx                # Layout raíz
│   └── page.tsx                  # Página principal
├── components/                   # Componentes compartidos
│   ├── ui/                       # Shadcn UI components
│   └── workout/                  # Componentes de entrenamiento
├── lib/                          # Lógica de negocio
│   ├── services/                 # Servicios de dominio
│   ├── ai/                       # Cliente OpenAI + prompts
│   ├── rules/                    # Reglas de progresión
│   └── utils/                    # Utilidades
├── prisma/                       # Esquema y migraciones
│   └── schema.prisma
└── public/                       # Assets estáticos
    ├── manifest.json             # PWA manifest
    ├── icons/                    # PWA icons
    └── offline.html              # Fallback offline
```

---

## Seguridad

| Aspecto | Implementación |
|---------|---------------|
| Apple Watch endpoint | Bearer token en header `Authorization` |
| Variables de entorno | `.env.local` (nunca en git) |
| API de OpenAI | API key en server-side only |
| HTTPS | Obligatorio para PWA + Service Worker |
| CORS | Restringido al dominio de la app |

---

## Escalabilidad

Al ser un proyecto de uso personal, la arquitectura prioriza **simplicidad** sobre escalabilidad horizontal:
- Servidor único (VPS o Vercel)
- Base de datos PostgreSQL única
- Sin microservicios ni colas de mensajes
- Sin CDN externo (Next.js sirve los assets)
