# Guía de despliegue

Arquitectura de producción recomendada (barata y sin sobreingeniería):

| Pieza | Dónde | Por qué |
|---|---|---|
| `apps/web` (Next.js: panel + storefront) | **Vercel** | Está hecho para Next.js; capa gratuita suficiente |
| `apps/api` (NestJS + widget) | **Railway** o **Render** (Docker) | Proceso persistente: SSE, bus de eventos, caché, workers |
| PostgreSQL + `pgvector` | **Neon**, **Supabase** o Postgres de Railway | Gestionado; `vector` disponible |
| Redis (Fase 1.3+) | Railway Redis / Upstash | Colas y pub/sub |
| Archivos (Fase 1.4) | Cloudflare R2 | S3 compatible, sin costo de egreso |

> **No despliegues la API en Vercel**: sus funciones cortan conexiones largas (SSE) y no mantienen
> estado entre invocaciones. El widget no necesita proyecto propio: la API lo sirve en `/widget-assets/`.

## 1. Base de datos

Crea un Postgres gestionado y copia la cadena de conexión. Prisma crea las extensiones `vector` y
`pgcrypto` en la primera migración; en Neon/Supabase/Railway están permitidas. Si tu proveedor exige
habilitarlas a mano: `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

## 2. API en Railway (o Render)

1. Nuevo proyecto → *Deploy from GitHub* → este repositorio.
2. **Builder**: Dockerfile. **Dockerfile path**: `apps/api/Dockerfile`. **Root/Context**: raíz del repo (`/`).
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` (Railway inyecta la suya; la API la lee de `PORT`) |
   | `DATABASE_URL` | la de tu Postgres, con `?schema=public` (y `sslmode=require` si el proveedor lo pide) |
   | `JWT_SECRET` | `openssl rand -hex 32` (≥ 32 caracteres; se rechazan valores de desarrollo) |
   | `FRONTEND_URL` | orígenes permitidos separados por coma, p. ej. `https://comercio.vercel.app,https://panel.tudominio.com` |
   | `AI_PROVIDER` | `gemini` (o `disabled` para el proveedor mock) |
   | `GEMINI_API_KEY` | tu clave |
   | `GEMINI_MODEL_SMALL` / `GEMINI_MODEL_LARGE` / `GEMINI_MODEL_EMBEDDING` | modelos disponibles en tu cuenta |

4. El contenedor ejecuta `prisma migrate deploy` al arrancar y luego la API. Verifica `https://TU-API/health`.
5. Carga los datos de plataforma (planes y plantillas) una vez. Opción simple desde tu máquina:
   `DATABASE_URL=<prod> npm run seed --workspace apps/api` — **ojo**: el seed también crea el tenant
   demo `chronos-watches`; bórralo después desde la BD si no lo quieres, o crea tu comercio con
   `POST /auth/register`. (Un comando `seed:platform` sin demo llega en el bloque 1.5.)

Render: *New Web Service* → Docker → mismo Dockerfile y variables. Activa *Health Check Path* `/health`.

## 3. Web en Vercel

En la pantalla *New Project* (import de GitHub):

1. En la lista de aplicaciones detectadas pulsa **Import single project** en **`web`** (Next.js).
   No uses el preset *Services* ni importes `api` ni `widget`.
2. **Root Directory**: `apps/web`. Framework: Next.js (auto). Deja activado *Include source files
   outside of the Root Directory* (necesario para `packages/shared`). Install/Build por defecto
   (`npm install` en la raíz ejecuta el `postinstall` que compila `packages/shared`).
3. **Environment Variables**: `NEXT_PUBLIC_API_URL` = `https://TU-API` (sin barra final).
4. Deploy. Luego añade el dominio de Vercel a `FRONTEND_URL` de la API (CORS) y redeploy de la API.

## 4. Widget en el sitio del comercio

```html
<script src="https://TU-API/widget-assets/embed.js" data-key="wk_xxx" async></script>
```

Crea la clave en `POST /tenants/me/widget-keys` con los dominios del comercio. Detalles en
[guia-widget.md](./guia-widget.md). Si prefieres CDN, sube `packages/widget/dist` y añade
`data-api="https://TU-API"` al script.

## 5. Comprobación post-despliegue

```bash
curl https://TU-API/health                      # {"status":"ok","database":"up"}
curl -I https://TU-API/widget-assets/embed.js   # 200, Access-Control-Allow-Origin: *
curl -I https://TU-API/api/docs                 # 404 en producción (Swagger solo en desarrollo)
```

Luego: registra un comercio (`POST /auth/register`), crea una clave de widget, pega el script en una
página y prueba el chat. Cambia un precio y vuelve a preguntar: debe responder con el dato nuevo.

## 6. Pendiente para producción seria (fases siguientes)

- Redis para el bus SSE y la caché cuando haya más de una instancia de la API.
- Observabilidad (logs estructurados, métricas, alertas) y backups automáticos de Postgres.
- Dominio propio para la API (`api.tudominio.com`) y para el widget si usas CDN.
- Reducir la imagen Docker (hoy ~1 GB por `node_modules` completo; `npm prune --omit=dev` en runtime baja a ~300 MB).
