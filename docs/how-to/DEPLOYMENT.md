# 🚀 Cómo Desplegar GymFit

> **Tipo de documento:** How-to Guide (Diataxis)
> Instrucciones directas para desplegar la PWA.

---

## Opción A: Vercel (Recomendada para MVP)

### 1. Conectar repositorio

1. Entra en [vercel.com](https://vercel.com)
2. Importa tu repositorio de GitHub/GitLab
3. Vercel detecta Next.js automáticamente

### 2. Configurar variables de entorno

En el dashboard de Vercel → Settings → Environment Variables:

```
DATABASE_URL = <tu-url-de-postgresql>
OPENAI_API_KEY = sk-...
OPENAI_MODEL = gpt-5.2
API_TOKEN = <tu-token>
NEXT_PUBLIC_APP_URL = https://tu-dominio.vercel.app
```

### 3. Base de datos

Si usas Vercel Postgres:
```bash
npx vercel env pull .env.local
npx prisma db push
```

Si usas PostgreSQL externo (Railway, Supabase, Neon, etc.), configura la `DATABASE_URL` con la URL de conexión.

### 4. Desplegar

```bash
git push origin main
```

Vercel despliega automáticamente en cada push a `main`.

### 5. Dominio personalizado (opcional)

Settings → Domains → Añadir dominio → Configurar DNS.

---

## Opción B: VPS Propio (Control total)

### 1. Preparar el servidor

```bash
# Ubuntu 22.04+
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y postgresql postgresql-contrib
```

### 2. Configurar PostgreSQL

```bash
sudo -u postgres createuser gymfit_user
sudo -u postgres createdb gymfit -O gymfit_user
sudo -u postgres psql -c "ALTER USER gymfit_user PASSWORD 'tu_password';"
```

### 3. Clonar y configurar

```bash
cd /var/www
git clone <repo-url> gymfit
cd gymfit
npm install
cp .env.example .env.local
# Editar .env.local con las credenciales del servidor
npx prisma db push
npm run build
```

### 4. Configurar PM2 para mantener el proceso

```bash
npm install -g pm2
pm2 start npm --name "gymfit" -- start
pm2 save
pm2 startup
```

### 5. Configurar Nginx + HTTPS

```nginx
# /etc/nginx/sites-available/gymfit
server {
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gymfit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.com
```

> **HTTPS es obligatorio** para que la PWA funcione en iPhone (Service Worker requiere HTTPS).

### 6. Actualizar

```bash
cd /var/www/gymfit
git pull origin main
npm install
npx prisma db push
npm run build
pm2 restart gymfit
```

---

## Añadir la PWA al iPhone

> Requisito: la app debe estar servida por HTTPS.

1. Abre **Safari** en tu iPhone
2. Navega a `https://tu-dominio.com`
3. Pulsa el botón de **compartir** (📤) en la barra inferior
4. Selecciona **"Añadir a pantalla de inicio"**
5. Confirma el nombre y pulsa **"Añadir"**

La app se abrirá como una aplicación standalone (sin barra de Safari), con splash screen e icono propio.

---

## Verificar la PWA

Tras desplegar, comprueba:

- [ ] La app se sirve por HTTPS
- [ ] El manifest.json es accesible en `/manifest.json`
- [ ] El Service Worker se registra correctamente
- [ ] La app se puede instalar en iPhone
- [ ] Funciona en modo standalone
- [ ] Las páginas cacheadas cargan offline
