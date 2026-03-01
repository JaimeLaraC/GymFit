# 📡 API Reference — GymFit

> **Tipo de documento:** Reference (Diataxis)
> Descripción factual de todos los endpoints y servicios.

---

## Base URL

```
Development: http://localhost:3000/api
Production:  https://<tu-dominio>/api
```

---

## Autenticación

Todos los endpoints protegidos requieren un Bearer token en el header:

```
Authorization: Bearer <TOKEN>
```

El token se configura en `.env.local` como `API_TOKEN`. Para uso personal, es un token estático.

---

## Endpoints

### 🍎 Recovery (Apple Watch)

#### `POST /api/recovery`

Recibe el snapshot de recuperación diario enviado desde iOS Shortcuts.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <TOKEN>
```

**Body:**
```json
{
  "date": "2026-03-01",
  "hrv_ms": 52.3,
  "resting_hr_bpm": 58,
  "sleep_hours": 7.5,
  "steps": 8432,
  "active_energy_kcal": 520.0,
  "spo2": 98.0,
  "body_temperature": 36.6,
  "respiratory_rate": 14.0,
  "subjective_energy": 7,
  "stress_level": 3
}
```

> Campos opcionales: `spo2`, `body_temperature`, `respiratory_rate`, `subjective_energy`, `stress_level`. Si son `null`, el backend usa la media de los últimos 7 días como fallback.

**Response (201):**
```json
{
  "id": "snap_abc123",
  "date": "2026-03-01",
  "recoveryScore": 78,
  "message": "Snapshot registrado correctamente"
}
```

**Errores:**
| Código | Descripción |
|--------|------------|
| 401 | Token inválido o ausente |
| 400 | Formato de fecha inválido o campos requeridos faltantes |
| 409 | Ya existe un snapshot para esa fecha |

---

### 🏋️ Workouts

#### `GET /api/workouts`
Lista de sesiones de entrenamiento con paginación.

**Query params:** `?page=1&limit=20&from=2026-01-01&to=2026-03-01`

**Response (200):**
```json
{
  "data": [
    {
      "id": "sess_123",
      "routineName": "Push Day A",
      "date": "2026-03-01T10:00:00Z",
      "durationMin": 72,
      "totalSets": 18,
      "effectiveSets": 14,
      "energyLevel": 8,
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156
  }
}
```

#### `GET /api/workouts/:id`
Detalle completo de una sesión, incluyendo todos los sets.

#### `POST /api/workouts`
Crear una nueva sesión de entrenamiento.

#### `PUT /api/workouts/:id`
Actualizar una sesión existente (añadir sets, cambiar notas, etc.).

#### `DELETE /api/workouts/:id`
Eliminar una sesión.

---

### 📚 Exercises

#### `GET /api/exercises`
Biblioteca de ejercicios con filtros.

**Query params:** `?muscle=chest&pattern=push&equipment=barbell&favorite=true`

#### `GET /api/exercises/:id`
Detalle de un ejercicio con historial de rendimiento.

#### `POST /api/exercises`
Crear un ejercicio personalizado.

#### `PUT /api/exercises/:id`
Editar un ejercicio (notas, cues, favorito/evitar).

---

### 📋 Routines

#### `GET /api/routines`
Lista de rutinas del usuario.

#### `GET /api/routines/:id`
Detalle de una rutina con sus ejercicios prescritos.

#### `POST /api/routines`
Crear una rutina nueva.

#### `PUT /api/routines/:id`
Modificar una rutina (añadir/quitar ejercicios, cambiar prescripción).

#### `POST /api/routines/:id/duplicate`
Duplicar una rutina (versioning: "PPL v1" → "PPL v2").

---

### 📊 Progress

#### `GET /api/progress/score`
Score global actual (0-100) con desglose por componentes.

**Response (200):**
```json
{
  "score": 82,
  "breakdown": {
    "performance": 85,
    "recovery": 78,
    "workload": 80,
    "adherence": 90,
    "alerts": 0
  },
  "trend": "improving",
  "recommendation": "Progresión normal, puedes añadir 1 serie a cuádriceps"
}
```

#### `GET /api/progress/metrics`
Métricas avanzadas: volumen semanal por músculo, tendencia e1RM, PRs.

**Query params:** `?period=4w&exercise_id=ex_123`

#### `GET /api/progress/body`
Historial de métricas corporales (peso, medidas).

#### `POST /api/progress/body`
Registrar nuevas medidas corporales.

#### `POST /api/progress/photos`
Subir foto de progreso.

#### `GET /api/progress/photos`
Galería de fotos de progreso con línea temporal.

---

### 🤖 AI (Asistente IA)

#### `POST /api/ai/chat`
Chat contextual con GPT-5.2. Streaming via Server-Sent Events.

**Body:**
```json
{
  "message": "Hoy me siento sin energía, ¿qué hago?",
  "context": {
    "includeLastWorkout": true,
    "includeRecovery": true,
    "includeProgress": true
  }
}
```

**Response:** Stream SSE con chunks de texto.

#### `POST /api/ai/generate-routine`
Genera una rutina personalizada con GPT-5.2.

**Body:**
```json
{
  "goal": "hypertrophy",
  "daysPerWeek": 4,
  "sessionDurationMin": 75,
  "equipment": ["barbell", "dumbbell", "cable", "machine"],
  "priorityMuscles": ["chest", "back"],
  "injuries": ["left_shoulder_impingement"],
  "periodization": "undulating"
}
```

#### `POST /api/ai/analyze-progress`
Análisis multivariable con GPT-5.2: cruza rendimiento, recuperación, volumen y adherencia.

#### `POST /api/ai/nutrition`
Análisis de foto de comida con GPT-5.2 Vision.

**Body:** `multipart/form-data` con campo `photo` (imagen).

**Response (200):**
```json
{
  "description": "Pechuga de pollo a la plancha con arroz integral y ensalada",
  "confidence": 0.85,
  "macros": {
    "calories": 520,
    "protein_g": 42,
    "carbs_g": 55,
    "fat_g": 12,
    "fiber_g": 6
  },
  "suggestions": [
    "Buena fuente de proteína. Podrías añadir más verduras para aumentar fibra."
  ],
  "followUpQuestions": [
    "¿La ración de arroz es aproximadamente un puño?",
    "¿Usaste aceite de oliva para cocinar?"
  ]
}
```

---

### 🍽️ Nutrition

#### `GET /api/nutrition`
Registro nutricional del día (o rango de fechas).

**Query params:** `?date=2026-03-01` o `?from=2026-02-25&to=2026-03-01`

#### `POST /api/nutrition`
Registrar una comida (manual o post-verificación de IA).

#### `PUT /api/nutrition/:id`
Corregir macros de una comida tras verificación.

#### `GET /api/nutrition/summary`
Resumen semanal: calorías promedio, macros, adherencia al objetivo.

---

### 🏆 Achievements

#### `GET /api/achievements`
Lista de logros del usuario (desbloqueados y disponibles).

#### `GET /api/achievements/stats`
Estadísticas: racha actual, PRs recientes, ranking personal.

---

## Códigos de Error Comunes

| Código | Significado |
|--------|------------|
| 200 | OK |
| 201 | Recurso creado |
| 400 | Bad Request (parámetros inválidos) |
| 401 | No autorizado (token inválido) |
| 404 | Recurso no encontrado |
| 409 | Conflicto (duplicado) |
| 500 | Error interno del servidor |

---

## Rate Limiting

Para uso personal no se implementa rate limiting estricto. Si se detecta abuso (p.ej. Shortcut enviando datos repetidos), el endpoint de recovery devuelve 409.
