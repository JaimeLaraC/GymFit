# ⌚ Cómo Configurar el Shortcut de Apple Watch

> **Tipo de documento:** How-to Guide (Diataxis)
> Instrucciones directas para crear y automatizar el iOS Shortcut.

---

## Requisitos

- iPhone con iOS 16+
- Apple Watch emparejado con datos de Salud activos
- GymFit desplegado con HTTPS (el endpoint `/api/recovery` debe estar accesible)
- Tu token de autenticación (`API_TOKEN` configurado en el backend)

---

## 1. Crear el Shortcut

Abre la app **Atajos** (Shortcuts) en tu iPhone.

### Paso 1: Nuevo atajo

1. Pulsa **"+"** → Nombre: **"GymFit Recovery"**

### Paso 2: Obtener datos de Salud

Añade estas acciones secuencialmente (busca "Obtener muestras de Salud" o "Find Health Samples"):

| Acción | Tipo de dato | Periodo |
|--------|-------------|---------|
| Obtener muestras de Salud | Frecuencia cardiaca en reposo | Últimas 24 horas |
| Obtener muestras de Salud | Sueño | Últimas 24 horas |
| Obtener muestras de Salud | Pasos | Hoy |
| Obtener muestras de Salud | Energía activa | Hoy |

**Si están disponibles** (depende de tu Watch y configuración):

| Acción | Tipo de dato | Periodo |
|--------|-------------|---------|
| Obtener muestras de Salud | Variabilidad del ritmo cardiaco (HRV) | Últimas 24 horas |
| Obtener muestras de Salud | Saturación de oxígeno | Últimas 24 horas |

### Paso 3: Solicitar entrada manual (energía subjetiva)

1. Añade acción **"Solicitar entrada"**
2. Tipo: Número
3. Pregunta: "¿Cómo te sientes hoy? (1-10)"
4. Guarda como variable: `subjectiveEnergy`

### Paso 4: Construir el JSON

Añade acción **"Diccionario"** con los siguientes campos:

| Clave | Valor |
|-------|-------|
| `date` | Fecha actual (formato ISO: YYYY-MM-DD) |
| `resting_hr_bpm` | Variable: Frecuencia cardiaca en reposo |
| `sleep_hours` | Variable: Duración sueño (convertir a horas) |
| `steps` | Variable: Pasos |
| `active_energy_kcal` | Variable: Energía activa |
| `hrv_ms` | Variable: HRV (o vacío si no disponible) |
| `spo2` | Variable: SpO₂ (o vacío si no disponible) |
| `subjective_energy` | Variable: `subjectiveEnergy` |

### Paso 5: Enviar los datos

Añade acción **"Obtener contenido de URL"** (Get Contents of URL):

| Campo | Valor |
|-------|-------|
| URL | `https://tu-dominio.com/api/recovery` |
| Método | POST |
| Headers | `Content-Type: application/json` |
| Headers | `Authorization: Bearer TU_TOKEN_AQUI` |
| Body | JSON → Diccionario del paso anterior |

### Paso 6: Notificación de resultado

Añade acción **"Mostrar notificación"**:
- Si respuesta OK → "✅ Recovery enviado correctamente"
- Si error → "❌ Error al enviar recovery"

---

## 2. Probar el Shortcut

1. Pulsa **"▶️ Ejecutar"** en el editor del Shortcut
2. Debería pedir tu energía subjetiva (1-10)
3. Verificar en GymFit que el snapshot aparece en la base de datos

---

## 3. Automatizar la ejecución diaria

1. En la app Atajos → pestaña **"Automatización"**
2. Pulsa **"+"** → **"Crear automatización personal"**
3. Elige: **"Hora del día"** → p.ej. 8:00 AM cada día
4. Acción: **"Ejecutar atajo"** → Selecciona **"GymFit Recovery"**
5. Desactiva **"Preguntar antes de ejecutar"** (si iOS lo permite)

> **Nota:** iOS puede solicitar confirmación manual dependiendo de la versión. En ese caso, recibirás una notificación diaria que debes pulsar para ejecutar.

---

## 4. Verificar que los datos llegan

Comprueba en la app GymFit:
- [ ] El snapshot aparece en la página de recuperación
- [ ] Los valores coinciden con los del Apple Watch
- [ ] El score de recuperación se actualiza
- [ ] Si falta alguna métrica, el fallback (media 7 días) funciona

---

## Resolución de problemas

**"El Shortcut no encuentra datos de Salud"**
→ Verifica que tu Apple Watch está emparejado y sincronizando en la app Salud.
→ Algunas métricas (HRV, SpO₂) necesitan que el Watch las registre activamente.

**"Error 401 al enviar datos"**
→ Revisa que el token en el header coincide exactamente con el `API_TOKEN` del backend.

**"Error de conexión"**
→ Verifica que la URL es correcta y usa HTTPS.
→ Shortcuts no puede hacer POST a URLs HTTP (sin HTTPS).

**"Datos de sueño incorrectos"**
→ Revisa que estás usando la categoría "Sueño" correcta en Salud. Puede haber varias fuentes (Watch, iPhone, apps de terceros).
