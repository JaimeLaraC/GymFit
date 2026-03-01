# 🏋️‍♂️ GymFit — App de Entrenamiento Inteligente

> Progressive Web App de entrenamiento enfocada en hipertrofia y objetivos personalizados, con asistente de IA (GPT-5.2) como entrenador personal inteligente.

<!-- Badges -->
![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

---

## 🎯 Visión General

GymFit es una aplicación web personal diseñada para optimizar el entrenamiento de fuerza e hipertrofia de forma científica. Incorpora un asistente de IA (OpenAI GPT-5.2) capaz de actuar como entrenador personal inteligente, analizando datos de entrenamiento, recuperación fisiológica (Apple Watch) y nutrición.

### Características principales

- 🏋️ **Entrenamiento inteligente** — Logging rápido, series efectivas, progresión automática
- 📊 **Progreso avanzado** — Score 0-100, gráficas, tendencias, análisis multivariable
- 🤖 **Asistente IA** — Chat contextual con GPT-5.2, generación de rutinas, ajuste por datos
- ⌚ **Apple Watch** — Integración vía iOS Shortcuts (HRV, FC, sueño, SpO₂)
- 🍽️ **Nutrición** — Registro por foto con IA, macros, seguimiento diario
- 📱 **PWA** — Instalable en iPhone sin App Store, funciona offline
- 🎮 **Gamificación** — Rachas, logros, PRs destacados

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| UI | React 19 + Shadcn UI + Radix UI |
| Estilos | Tailwind CSS |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| IA | OpenAI GPT-5.2 (Chat + Vision) |
| PWA | next-pwa / Workbox |
| Testing | Vitest + Playwright |

---

## 📚 Documentación

Toda la documentación sigue el framework [Diataxis](https://diataxis.fr/):

### 📖 Reference (Descripción factual)
- [Arquitectura Técnica](docs/reference/ARCHITECTURE.md)
- [Modelo de Datos](docs/reference/DATA_MODEL.md)
- [API Reference](docs/reference/API_REFERENCE.md)
- [Stack Tecnológico](docs/reference/TECH_STACK.md)
- [Glosario](docs/reference/GLOSSARY.md)

### 💡 Explanation (Entender el porqué)
- [Módulos del Sistema](docs/explanation/MODULES.md)
- [Motor de IA](docs/explanation/AI_ENGINE.md)
- [Integración Apple Watch](docs/explanation/APPLE_WATCH_INTEGRATION.md)
- [Base Científica](docs/explanation/SCIENTIFIC_BASIS.md)

### 🔧 How-to Guides (Cómo hacer X)
- [Setup del Proyecto](docs/how-to/SETUP.md)
- [Despliegue](docs/how-to/DEPLOYMENT.md)
- [Configurar Shortcut Apple Watch](docs/how-to/APPLE_WATCH_SHORTCUT.md)

### 🎓 Tutorials (Aprender haciendo)
- [Tu Primer Entrenamiento](docs/tutorials/FIRST_WORKOUT.md)

### 📋 Transversales
- [Diseño UI/UX](docs/UI_UX.md)
- [Estándares de Código](docs/CODING_STANDARDS.md)
- [Estrategia de Testing](docs/TESTING_STRATEGY.md)
- [Estrategia PWA](docs/PWA_STRATEGY.md)
- [Roadmap](docs/ROADMAP.md)

---

## 🚀 Quick Start

```bash
# Clonar e instalar
git clone <repo-url>
cd GymFit
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Levantar la base de datos
npx prisma db push

# Arrancar en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## 📱 Instalación en iPhone

1. Abrir la URL de la app en Safari (iPhone)
2. Pulsar el botón de compartir (📤)
3. Seleccionar "Añadir a pantalla de inicio"
4. La app se abrirá como aplicación nativa (standalone)

---

## 📝 Requisitos del Sistema

- **Node.js** 20+
- **PostgreSQL** 15+
- **Navegador moderno** (Safari iOS 16+, Chrome, Firefox)
- **iPhone + Apple Watch** (para integración de datos fisiológicos)

---

## 👤 Autor

**Jaime Lara** — Proyecto personal de uso privado.

---

## 📄 Licencia

Proyecto privado. Todos los derechos reservados.
