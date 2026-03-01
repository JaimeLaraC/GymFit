# 📱 Estrategia PWA — GymFit

> Configuración de Progressive Web App para instalación en iPhone y uso offline.

---

## Requisitos PWA para iPhone

| Requisito | Estado |
|-----------|--------|
| HTTPS | Obligatorio |
| Web App Manifest | Con `display: standalone`, iconos 192+512px |
| Service Worker con fetch handler | Obligatorio para caching |
| Meta tags Apple-specific | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` |

---

## Web App Manifest

```json
{
  "name": "GymFit — Entrenamiento Inteligente",
  "short_name": "GymFit",
  "description": "App de entrenamiento con IA para hipertrofia y fuerza",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0f1219",
  "theme_color": "#22c55e",
  "lang": "es",
  "categories": ["health", "fitness"],
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Empezar entreno",
      "short_name": "Entrenar",
      "url": "/train?source=shortcut",
      "icons": [{ "src": "/icons/shortcut-train.png", "sizes": "192x192" }]
    },
    {
      "name": "Chat con IA",
      "short_name": "IA",
      "url": "/ai?source=shortcut",
      "icons": [{ "src": "/icons/shortcut-ai.png", "sizes": "192x192" }]
    }
  ]
}
```

---

## Meta Tags Apple (en layout.tsx)

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="GymFit" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="apple-touch-startup-image" href="/icons/splash.png" />
```

---

## Estrategia de Caching

| Recurso | Estrategia | TTL | Razón |
|---------|-----------|-----|-------|
| HTML/CSS/JS (estáticos) | **Cache First** | Hasta nueva versión | Carga instantánea |
| Imágenes de ejercicios | **Cache First** | 30 días | Assets que no cambian |
| API de datos (entrenos, métricas) | **Network First** | Fallback a cache | Datos frescos prioritarios |
| API de IA (chat, análisis) | **Network Only** | — | Requiere conexión, no cacheable |
| Fotos de progreso/comida | **Cache First** | 90 días | Subidas por el usuario |
| Fonts | **Cache First** | 365 días | Nunca cambian |

---

## Offline Support

### Funcionalidades offline

| Funcionalidad | Disponible offline | Notas |
|--------------|-------------------|-------|
| Ver última sesión | ✅ | Datos cacheados |
| Registrar entreno | ✅ | Se encola y sincroniza al reconectar |
| Ver historial | ✅ (parcial) | Solo datos previamente visitados |
| Chat con IA | ❌ | Requiere conexión a OpenAI |
| Subir fotos | ⚠️ Encolado | Se sube al reconectar |
| Ver score global | ✅ | Último score calculado |

### Background Sync

```javascript
// Cuando el usuario registra un entreno offline,
// se almacena en IndexedDB y se sincroniza con Background Sync
// al recuperar conexión.
```

### Offline Fallback Page

Si el usuario navega a una página no cacheada sin conexión, se muestra una página offline personalizada con el mensaje:

```
📡 Sin conexión
Puedes seguir registrando tu entreno.
Los datos se sincronizarán cuando vuelvas a tener conexión.
[Ir a entrenar]
```

---

## Implementación con next-pwa

```javascript
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-stylesheets",
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/api\/(?!ai).*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

module.exports = withPWA({ /* next config */ });
```

---

## Lighthouse Checklist

- [ ] PWA badge (Installable + Offline-ready)
- [ ] Performance score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Manifest válido con todos los campos
- [ ] Service Worker registrado con fetch handler
- [ ] Iconos en todos los tamaños requeridos
- [ ] HTTPS activo
