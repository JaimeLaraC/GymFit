# 🎨 Diseño UI/UX — GymFit

> Guía de diseño del sistema visual y experiencia de usuario.

---

## Filosofía de Diseño

GymFit prioriza la **mínima fricción** en el gimnasio. Cada interacción debe ser rápida, clara y accesible con una mano sudada.

**Principios:**
1. **Mobile-first** — iPhone es el dispositivo principal
2. **Dark mode** por defecto — Mejor en entornos de gym con luz variable
3. **Toque mínimo** — Registrar una serie en 2-3 toques
4. **Información progresiva** — Mostrar lo esencial, detalles bajo demanda
5. **Feedback instantáneo** — Micro-animaciones para confirmar acciones

---

## Sistema de Diseño

### Paleta de Colores

| Nombre | Valor | Uso |
|--------|-------|-----|
| **Background** | `hsl(222, 47%, 8%)` | Fondo principal (dark) |
| **Surface** | `hsl(222, 30%, 12%)` | Cards y contenedores |
| **Surface Elevated** | `hsl(222, 25%, 16%)` | Modales, elementos flotantes |
| **Primary** | `hsl(142, 76%, 46%)` | Acciones principales, progreso positivo |
| **Primary Muted** | `hsl(142, 50%, 20%)` | Backgrounds de elementos primarios |
| **Secondary** | `hsl(217, 91%, 60%)` | Info, links, elementos secundarios |
| **Warning** | `hsl(38, 92%, 55%)` | Alertas amarillas, score medio |
| **Danger** | `hsl(0, 84%, 60%)` | Errores, score bajo, dolor |
| **Text Primary** | `hsl(0, 0%, 95%)` | Texto principal |
| **Text Secondary** | `hsl(0, 0%, 65%)` | Texto secundario |
| **Text Muted** | `hsl(0, 0%, 45%)` | Labels, placeholders |
| **Border** | `hsl(222, 20%, 20%)` | Bordes sutiles |

### Tipografía

| Nivel | Fuente | Peso | Tamaño |
|-------|--------|------|--------|
| H1 | Inter | 700 | 28px |
| H2 | Inter | 600 | 22px |
| H3 | Inter | 600 | 18px |
| Body | Inter | 400 | 16px |
| Small | Inter | 400 | 14px |
| Caption | Inter | 500 | 12px |
| Monospace (datos) | JetBrains Mono | 500 | 16px |

### Spacing

Base unit: `4px`. Escala: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

### Esquinas

- Cards, buttons: `12px`
- Inputs: `10px`
- Badges, chips: `9999px` (pill)

---

## Navegación

### Bottom Navigation Bar (5 tabs)

```
┌──────────────────────────────────────────────┐
│                                              │
│              [Contenido de la vista]         │
│                                              │
├──────────────────────────────────────────────┤
│  🏠      🏋️      📊      🤖      👤       │
│ Home   Entrenar  Progreso   IA    Perfil     │
└──────────────────────────────────────────────┘
```

| Tab | Pantalla | Contenido principal |
|-----|----------|-------------------|
| 🏠 Home | Dashboard | Score global, próxima sesión, últimas alertas |
| 🏋️ Entrenar | Workout | Rutinas, ejecución en vivo, historial |
| 📊 Progreso | Progress | Métricas, gráficas, fotos, medidas |
| 🤖 IA | Assistant | Chat con GPT-5.2, sugerencias, análisis |
| 👤 Perfil | Profile | Configuración, logros, nutrición |

---

## Pantallas Principales

### Dashboard (Home)

```
┌─────────────────────────────────┐
│  GymFit            📅 hoy      │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │    SCORE: 82 / 100      │   │
│  │    🟢 Progresando bien  │   │
│  │    [ver detalles →]     │   │
│  └─────────────────────────┘   │
│                                 │
│  📋 Próxima sesión             │
│  ┌─────────────────────────┐   │
│  │  Push Day A  •  ~65 min │   │
│  │  [▶ Empezar entrenar]   │   │
│  └─────────────────────────┘   │
│                                 │
│  📊 Resumen semanal            │
│  Series efectivas: 42/48       │
│  ████████████████░░ 87%        │
│                                 │
│  ⚠️ Alertas                    │
│  • Sueño bajo 3 días seguidos  │
└─────────────────────────────────┘
```

### Logging de Entrenamiento

```
┌─────────────────────────────────┐
│  ← Push Day A       ⏱️ 32:15  │
├─────────────────────────────────┤
│                                 │
│  1/5 PRESS BANCA               │
│  Última vez: 80kg × 8,7,6      │
│                                 │
│  Serie 1: ✅ 80kg × 8  RIR 2  │
│  Serie 2: ✅ 80kg × 7  RIR 3  │
│  Serie 3:                       │
│  ┌────┐  ┌────┐  ┌────┐       │
│  │ 80 │  │    │  │    │       │
│  │ kg  │  │reps│  │RIR │       │
│  └────┘  └────┘  └────┘       │
│                                 │
│      [✓ Guardar]  [= Rep]      │
│                                 │
│  ⏳ Descanso: 1:45 / 2:00     │
│  ████████████████░░░░          │
│                                 │
│  📝 Añadir nota...             │
│  [+ Serie]  [→ Siguiente]      │
└─────────────────────────────────┘
```

---

## Micro-animaciones

| Interacción | Animación | Duración |
|-------------|-----------|---------|
| Serie guardada | ✅ bounce + confetti si es PR | 300ms |
| PR batido | 🏆 overlay con celebración | 1500ms |
| Score calculado | Conteo animado de 0 al valor | 800ms |
| Tab cambio | Slide lateral + fade | 200ms |
| Descanso completado | Vibración háptica + sonido | instant |
| Card expandir | Scale + opacity con spring | 250ms |

---

## Responsive

| Breakpoint | Dispositivo | Ajuste |
|-----------|------------|--------|
| < 390px | iPhone SE | Compact layout, font -1 |
| 390-430px | iPhone 14/15/16 | Default layout |
| > 768px | iPad / Desktop | Two-column layout |

---

## Accesibilidad

- **Contraste mínimo:** WCAG AA (4.5:1 para texto, 3:1 para UI grande)
- **Touch targets:** Mínimo 44×44px para botones y links
- **Labels:** Todos los inputs y botones con `aria-label`
- **Idioma:** Español como idioma principal (`lang="es"`)
