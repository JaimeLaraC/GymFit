# 🔧 Cómo Configurar el Proyecto — GymFit

> **Tipo de documento:** How-to Guide (Diataxis)
> Asume que sabes lo que quieres hacer. Va directo al grano.

---

## Requisitos Previos

- Node.js 20+ instalado
- PostgreSQL 15+ corriendo
- npm 10+
- Git

---

## 1. Clonar el repositorio

```bash
git clone <repo-url>
cd GymFit
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/gymfit?schema=public"

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.2"

# Token de autenticación (Apple Watch)
API_TOKEN="<genera-un-token-aleatorio-de-64-caracteres>"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Para generar un token aleatorio:

```bash
openssl rand -hex 32
```

## 4. Crear la base de datos

```bash
# Crear la base de datos en PostgreSQL
createdb gymfit

# Aplicar el esquema con Prisma
npx prisma db push

# (Opcional) Abrir Prisma Studio para inspeccionar
npx prisma studio
```

## 5. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Problemas comunes

**"Error: P1001 Can't reach database server"**
→ Verifica que PostgreSQL está corriendo: `sudo systemctl status postgresql`

**"Error: OPENAI_API_KEY is not set"**
→ Asegúrate de que `.env.local` tiene la clave y reinicia el dev server.

**"prisma: command not found"**
→ Usa `npx prisma` en lugar de `prisma` directamente.
