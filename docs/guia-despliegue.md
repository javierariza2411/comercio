# Guía de despliegue

Arquitectura de producción recomendada (barata y sin sobreingeniería):

| Pieza | Dónde | Por qué |
|---|---|---|
| `apps/web` (Next.js: panel + storefront) | **Vercel** | Está hecho para Next.js; capa gratuita suficiente |
| `apps/api` (NestJS + widget) | **Render** (Docker) | Instancia gratuita para pruebas; duerme tras 15 min sin tráfico |
| PostgreSQL + `pgvector` | **Neon** | Gestionado; `vector` disponible |
| Redis (Fase 1.3+) | Railway Redis / Upstash | Colas y pub/sub |
| Imágenes | **Neon Object Storage** | S3 compatible y conectado al mismo proyecto |

> **No despliegues la API en Vercel**: sus funciones cortan conexiones largas (SSE) y no mantienen
> estado entre invocaciones. El widget no necesita proyecto propio: la API lo sirve en `/widget-assets/`.

## 1. Base de datos

Crea un Postgres gestionado y copia la cadena de conexión. Prisma crea las extensiones `vector` y
`pgcrypto` en la primera migración; Neon las permite. Si tu proveedor exige
habilitarlas a mano: `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

En **Neon Object Storage**, el bucket de imágenes debe tener acceso `public_read`; la API conserva las
credenciales de escritura en Render y el storefront solo consume las URLs públicas. Copia desde Neon el
endpoint, la región y las dos credenciales AWS. Nunca pongas esas credenciales en Vercel ni en variables
con prefijo `NEXT_PUBLIC_`.

## 2. API en Render

La opción más segura es **New → Blueprint** y seleccionar este repositorio. Render leerá `render.yaml`,
usará `apps/api/Dockerfile`, mantendrá el contexto en la raíz del monorepo, configurará `/health` y
generará `JWT_SECRET`. También puedes crear un Web Service manual con esos mismos valores.

1. Conecta GitHub y selecciona este repositorio y la rama `main`.
2. Confirma **Runtime: Docker**, **Plan: Free**, Dockerfile `apps/api/Dockerfile` y contexto `.`.
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | No la declares: Render inyecta `10000` y la API la lee automáticamente |
   | `DATABASE_URL` | cadena de conexión que entrega Neon; conserva sus parámetros SSL |
   | `JWT_SECRET` | `openssl rand -hex 32` (≥ 32 caracteres; se rechazan valores de desarrollo) |
   | `FRONTEND_URL` | orígenes permitidos separados por coma, p. ej. `https://comercio.vercel.app,https://panel.tudominio.com` |
   | `AI_PROVIDER` | `gemini` (o `disabled` para el proveedor mock) |
   | `GEMINI_API_KEY` | tu clave |
   | `GEMINI_MODEL_SMALL` / `GEMINI_MODEL_LARGE` / `GEMINI_MODEL_EMBEDDING` | modelos disponibles en tu cuenta |
   | `AWS_ENDPOINT_URL_S3` | endpoint S3 que entrega Neon Object Storage |
   | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | credenciales del storage de Neon |
   | `AWS_REGION` | región indicada por Neon |
   | `S3_BUCKET` | nombre exacto del bucket público |
   | `S3_PUBLIC_URL` | URL pública base del bucket (`endpoint/bucket`, sin barra final) |

4. Usa `/health` como Health Check Path.
5. El contenedor ejecuta `prisma migrate deploy` al arrancar y luego la API. Verifica `https://TU-APP.onrender.com/health`.
6. Carga los datos de plataforma (planes y plantillas) una vez. Opción simple desde tu máquina:
   `DATABASE_URL=<prod> npm run seed --workspace apps/api` — **ojo**: el seed también crea el tenant
   demo `chronos-watches`; bórralo después desde la BD si no lo quieres, o crea tu comercio con
   `POST /auth/register`. (Un comando `seed:platform` sin demo llega en el bloque 1.5.)

La instancia gratuita de Render se apaga después de 15 minutos sin tráfico y puede tardar cerca de un
minuto en despertar. Esto no borra imágenes ni datos, porque ambos viven en Neon.

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
- Añadir observabilidad y alertas para errores de subida y latencia de arranque en frío.
