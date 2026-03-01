# 📖 Glosario de Términos — GymFit

> **Tipo de documento:** Reference (Diataxis)
> Definiciones factuales de términos usados en la aplicación.

---

## Términos de Entrenamiento

| Término | Definición |
|---------|-----------|
| **RIR** (Reps In Reserve) | Repeticiones que podrías haber hecho antes del fallo muscular. RIR 2 = podrías haber hecho 2 más. |
| **RPE** (Rate of Perceived Exertion) | Escala 1-10 de esfuerzo percibido. RPE 8 = RIR 2. |
| **e1RM** (Estimated 1 Rep Max) | Peso máximo estimado para 1 repetición. Fórmula Epley: `Peso × (1 + Reps/30)`. |
| **Serie efectiva** | Serie realizada con RIR ≤ 3 (cerca del fallo). Las series lejos del fallo generan menos estímulo hipertrófico. |
| **Junk volume** | Volumen de entrenamiento que no contribuye al crecimiento: series con RIR alto, exceso de volumen más allá del MRV. |
| **Volumen** | Número total de series semanales para un grupo muscular. Se cuentan solo series efectivas. |
| **Doble progresión** | Método: subir reps dentro de un rango → cuando alcanzas el tope, subir peso y volver al mínimo del rango. |
| **Top set + back-off** | 1 serie pesada principal (top set) seguida de series más ligeras (back-off) al 85-90% del top set. |
| **Rest-pause** | Técnica: llegar cerca del fallo, descansar 10-20s, continuar hasta el fallo varias veces. |
| **Deload** | Semana de descarga: reducción del 40-60% del volumen y/o intensidad para gestionar fatiga acumulada. |
| **Mesociclo** | Bloque de entrenamiento de 4-8 semanas con un objetivo específico. |
| **Periodización** | Organización planificada del entrenamiento en fases con diferentes objetivos y estímulos. |
| **Periodización lineal** | Incremento progresivo de intensidad con reducción de volumen a lo largo del mesociclo. |
| **Periodización ondulante** | Variación de intensidad y volumen dentro de la misma semana (p.ej. día pesado/ligero/medio). |
| **Periodización por bloques** | Fases secuenciales: acumulación (volumen) → intensificación (fuerza) → realización (pico). |

---

## Términos de Volumen Individual

| Término | Definición |
|---------|-----------|
| **MEV** (Minimum Effective Volume) | Volumen mínimo semanal para mantener las adaptaciones actuales. ~6-8 series/músculo/semana típico. |
| **MAV** (Maximum Adaptive Volume) | Volumen que produce las mayores ganancias. Se encuentra entre MEV y MRV. |
| **MRV** (Maximum Recoverable Volume) | Volumen máximo del que puedes recuperarte. Superarlo → sobreentrenamiento funcional. ~20-25 series/músculo/semana típico. |

---

## Términos Fisiológicos

| Término | Definición |
|---------|-----------|
| **HRV** (Heart Rate Variability) | Variabilidad del intervalo entre latidos. Mayor HRV → mejor recuperación y adaptación parasimpática. Se mide como SDNN (ms). |
| **FC reposo** (Frecuencia Cardiaca en Reposo) | Latidos por minuto en reposo completo. Valores bajos indican buena capacidad cardiovascular. Subidas inesperadas pueden indicar fatiga o estrés. |
| **SpO₂** (Saturación de Oxígeno) | Porcentaje de hemoglobina saturada con oxígeno. Normal: 95-100%. Valores bajos pueden indicar problemas respiratorios o fatiga extrema. |
| **Fatiga sistémica** | Fatiga generalizada del sistema nervioso central, no localizada en un músculo. Se manifiesta como bajo rendimiento global, sueño pobre y cansancio mental. |
| **Sobreentrenamiento funcional** | Estado de fatiga acumulada reversible con 1-2 semanas de descanso/deload. Diferente del sobreentrenamiento crónico (que requiere meses). |

---

## Términos de Composición Corporal

| Término | Definición |
|---------|-----------|
| **Hipertrofia** | Aumento del tamaño muscular. Objetivo principal de GymFit. |
| **Recomposición** | Ganar músculo y perder grasa simultáneamente. Posible en principiantes o tras un periodo de desentrenamiento. |
| **Definición** | Fase de restricción calórica para reducir grasa corporal conservando la masa muscular. |
| **Volumen (fase)** | Fase de superávit calórico para maximizar la ganancia muscular. Implica cierta ganancia de grasa. |

---

## Términos de Nutrición

| Término | Definición |
|---------|-----------|
| **Macros** | Macronutrientes: proteínas (g), carbohidratos (g) y grasas (g). |
| **TDEE** | Gasto energético total diario. Base para calcular necesidades calóricas. |
| **Superávit calórico** | Comer más calorías de las que gastas. Necesario para fase de volumen (200-500 kcal/día). |
| **Déficit calórico** | Comer menos calorías de las que gastas. Necesario para fase de definición (300-500 kcal/día). |

---

## Términos Técnicos

| Término | Definición |
|---------|-----------|
| **PWA** (Progressive Web App) | Aplicación web que puede instalarse como app nativa, funcionar offline y recibir notificaciones push. |
| **Service Worker** | Script que corre en segundo plano en el navegador. Intercepta peticiones de red para cachear recursos y habilitar offline. |
| **Web App Manifest** | Archivo JSON que describe la app al navegador: nombre, icono, color, modo de visualización. Permite la instalación como PWA. |
| **Server Components** | Componentes de React que se renderizan en el servidor. Menor JavaScript en el cliente, acceso directo a datos. |
| **API Routes** | Endpoints HTTP definidos en Next.js dentro de la carpeta `app/api/`. Actúan como backend integrado. |
| **Prisma** | ORM para Node.js/TypeScript con esquema declarativo y queries type-safe. |
| **Streaming (SSE)** | Server-Sent Events. Técnica para enviar datos del servidor al cliente en tiempo real (usada para chat con IA). |
| **Recovery Snapshot** | Registro diario de métricas fisiológicas (HRV, FC, sueño, etc.) enviado desde Apple Watch vía iOS Shortcuts. |
