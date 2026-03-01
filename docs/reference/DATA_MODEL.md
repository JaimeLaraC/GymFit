# 🗃️ Modelo de Datos — GymFit

> **Tipo de documento:** Reference (Diataxis)
> Descripción factual del esquema de base de datos.

---

## Diagrama Entidad-Relación

```mermaid
erDiagram
    User ||--o{ Program : "tiene"
    User ||--o{ BodyMetric : "registra"
    User ||--o{ ProgressPhoto : "sube"
    User ||--o{ Meal : "registra"
    User ||--o{ Achievement : "obtiene"
    User ||--o{ Session : "realiza"

    Program ||--o{ Block : "contiene"
    Program ||--o{ Routine : "define"

    Block ||--o{ Routine : "incluye"

    Routine ||--o{ RoutineExercise : "tiene"

    Exercise ||--o{ RoutineExercise : "usado en"
    Exercise ||--o{ WorkoutSet : "ejecutado como"

    Session ||--o{ WorkoutSet : "registra"
    Session ||--o| RecoverySnapshot : "asociado a"

    RoutineExercise ||--|| Exercise : "referencia"

    User {
        string id PK
        string name
        string level "beginner|intermediate|advanced"
        string goal "hypertrophy|strength|recomposition|definition"
        json preferences
        datetime createdAt
        datetime updatedAt
    }

    Program {
        string id PK
        string userId FK
        string name
        int durationWeeks
        string periodizationType "linear|undulating|block|specialization"
        string status "active|completed|paused"
        datetime startDate
        datetime endDate
        datetime createdAt
    }

    Block {
        string id PK
        string programId FK
        string name
        int weeks
        string objective "accumulation|intensification|realization|deload"
        int order
    }

    Routine {
        string id PK
        string programId FK
        string blockId FK
        string name
        int dayOfWeek "0-6"
        string version
        int estimatedDurationMin
        int targetVolume
        int targetRIR
        datetime createdAt
    }

    Exercise {
        string id PK
        string name
        string primaryMuscle
        string[] secondaryMuscles
        string pattern "push|pull|squat|hinge|carry|isolation"
        string equipment "barbell|dumbbell|cable|machine|bodyweight"
        string difficulty "beginner|intermediate|advanced"
        int minRepRange
        int maxRepRange
        int recommendedRIR
        string[] cues
        string[] commonMistakes
        string notes
        boolean isFavorite
        boolean isAvoided
        string avoidReason
    }

    RoutineExercise {
        string id PK
        string routineId FK
        string exerciseId FK
        int order
        int targetSets
        int targetMinReps
        int targetMaxReps
        int targetRIR
        int restSeconds
        string method "standard|double_progression|top_set_backoff|rest_pause"
    }

    Session {
        string id PK
        string userId FK
        string routineId FK
        datetime date
        int durationMin
        string notes
        int energyLevel "1-10"
        int overallRPE "1-10"
        string status "in_progress|completed|skipped"
        datetime createdAt
    }

    WorkoutSet {
        string id PK
        string sessionId FK
        string exerciseId FK
        int setNumber
        int reps
        float weight
        int rir
        int rpe
        int restSeconds
        boolean isEffective "calculated from RIR"
        string notes
        datetime completedAt
    }

    RecoverySnapshot {
        string id PK
        string userId FK
        string sessionId FK
        date date
        float hrvMs "SDNN"
        int restingHrBpm
        float sleepHours
        int steps
        float activeEnergyKcal
        float spo2
        float bodyTemperature
        float respiratoryRate
        int subjectiveEnergy "1-10, manual"
        int stressLevel "1-10, manual"
        string source "shortcut|manual|xml_import"
        datetime createdAt
    }

    BodyMetric {
        string id PK
        string userId FK
        date date
        float weightKg
        float chestCm
        float waistCm
        float hipsCm
        float leftArmCm
        float rightArmCm
        float leftThighCm
        float rightThighCm
        float calfCm
        float shouldersCm
        string notes
        datetime createdAt
    }

    ProgressPhoto {
        string id PK
        string userId FK
        date date
        string imageUrl
        string angle "front|side|back"
        string notes
        datetime createdAt
    }

    Meal {
        string id PK
        string userId FK
        datetime date
        string photoUrl
        string description
        float calories
        float proteinG
        float carbsG
        float fatG
        float fiberG
        string source "ai_photo|manual"
        boolean verified
        string notes
        datetime createdAt
    }

    Achievement {
        string id PK
        string userId FK
        string type "streak|pr|milestone|badge"
        string name
        string description
        json value
        datetime unlockedAt
    }
```

---

## Entidades Principales

### User
Perfil del usuario con nivel, objetivo y preferencias. Relación raíz con todos los demás datos.

### Program → Block → Routine → RoutineExercise
Jerarquía de planificación: un programa contiene bloques (fases de periodización), cada bloque tiene rutinas asignadas a días, y cada rutina contiene ejercicios con prescripción específica (series, reps, RIR, método de progresión).

### Exercise
Biblioteca de ejercicios con clasificación por músculo, patrón de movimiento, equipamiento y dificultad. Incluye cues de técnica, errores comunes, y flags personales (favorito/evitar).

### Session → WorkoutSet
Registro de entrenamiento real. Una sesión agrupa todos los sets ejecutados en un entreno. Cada `WorkoutSet` registra reps, peso, RIR/RPE y calcula automáticamente si es una **serie efectiva** (cerca del fallo).

### RecoverySnapshot
Datos fisiológicos diarios procedentes del Apple Watch vía iOS Shortcuts. Incluye fallback a valores manuales (`subjectiveEnergy`, `stressLevel`). Campo `source` indica la procedencia del dato.

### BodyMetric / ProgressPhoto
Registro de progreso corporal: medidas periódicas y fotos comparativas.

### Meal
Registro nutricional con análisis por foto (IA) o entrada manual. Incluye flag de verificación post-análisis.

### Achievement
Sistema de gamificación: rachas de entrenamiento, PRs, hitos y badges.

---

## Índices Recomendados

| Entidad | Campo(s) | Tipo | Razón |
|---------|---------|------|-------|
| Session | `userId`, `date` | Compuesto | Consultas de historial por fecha |
| WorkoutSet | `sessionId` | Simple | Recuperar sets de una sesión |
| WorkoutSet | `exerciseId` | Simple | Historial por ejercicio |
| RecoverySnapshot | `userId`, `date` | Compuesto, Único | Un snapshot por día |
| BodyMetric | `userId`, `date` | Compuesto | Tendencia corporal |
| Exercise | `primaryMuscle` | Simple | Filtro por músculo |
| Exercise | `pattern` | Simple | Filtro por patrón |

---

## Campos Calculados (no persistidos)

Estos valores se calculan en tiempo real dentro de los servicios:

| Campo | Fórmula / Lógica |
|-------|-----------------|
| `e1RM` | Peso × (1 + Reps / 30) — Epley |
| `isEffective` | `true` si RIR ≤ 3 |
| `weeklyVolumePerMuscle` | Σ sets efectivos de la semana para cada músculo |
| `recoveryScore` | Fórmula ponderada (HRV, FC, sueño, energía) |
| `globalScore` | Combinación de rendimiento + recuperación + adherencia |
| `smoothedWeight` | Media móvil exponencial del peso corporal |
