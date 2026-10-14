# SmartCommerce

Plataforma SaaS multi-tenant de **chat web para comercios**: cada negocio instala un widget en su
página, carga su conocimiento (FAQ, políticas, catálogo, documentos) y el bot resuelve la mayoría
de las consultas desde la web. WhatsApp queda como canal opcional de escalamiento.

- [docs/arquitectura.md](./docs/arquitectura.md) — arquitectura objetivo, agente con herramientas, modelo de datos, API, decisiones y costos.
- [docs/backlog-mvp.md](./docs/backlog-mvp.md) — historias de usuario con criterios de aceptación.
- [docs/guia-widget.md](./docs/guia-widget.md) — instalación del widget en cualquier web.
- [docs/guia-despliegue.md](./docs/guia-despliegue.md) — Vercel (web) + Railway/Render con Docker (API) + Postgres gestionado.

**Principio rector**: nada del negocio vive en el código. Textos, colores, precios, horarios, tono del
bot, reglas y límites se guardan por tenant (o en plantillas de industria y planes en BD) y se editan
desde la API/panel sin redeploy.

## Estado

| Fase | Estado |
|---|---|
| 0 · Saneamiento (seguridad, multi-tenant, Postgres/Prisma, tests, CI, Docker, config por plantilla) | ✅ Completa |
| 1.1 · Chat en tiempo real (SSE) + widget embebible (<50 KB) + inbox de agentes | ✅ Completa |
| 1.2 · Agente único con 10 herramientas, capa LLM intercambiable (Gemini/Mock), guardrails, simulador | ✅ Completa |
| 1.3 · Conocimiento: ingesta PDF/Excel/texto, embeddings pgvector, FAQ exacta sin LLM, suite de evaluación | ⏳ Siguiente |
| 1.4 · Catálogo avanzado: import/export Excel, campos personalizados, estados, fotos a S3 | Pendiente |
| 1.5 · Panel sin código: configuración del negocio, sedes/horarios, envíos, promos, widget, simulador | Pendiente |
| 1.6 · Leads con consentimiento en widget, notificaciones de handoff, analítica, "estuvo mal", límites | Pendiente |
| 2 · Monetización (planes, Wompi, onboarding por URL, analítica avanzada) | Pendiente |
| 3 · Escala (WhatsApp, 2FA, auditoría, marca blanca, observabilidad) | Pendiente |

## Stack

- **API**: NestJS 12 (ESM) · Prisma 6 · PostgreSQL 16 + pgvector · Redis · JWT (access + refresh rotativo) · Throttler · Swagger · SSE
- **IA**: agente único con *function calling*, `LlmProvider` propio (Gemini REST, Mock), router pequeño/grande, guardrail de cifras, caché por versión de datos
- **Widget**: `packages/widget` — loader IIFE (1,6 KB gz) + app Preact en iframe (≈10,5 KB gz)
- **Web**: Next.js 14 (App Router) · Tailwind — panel del comercio y storefront opcional
- **Compartido**: `packages/shared` (tipos y utilidades de dinero)
- **Infra local**: Docker Compose (Postgres, Redis, S3 compatible RustFS)
- **Calidad**: Vitest (unitarias + e2e), ESLint 9, GitHub Actions

## Monorepo

```text
smartcommerce/
├─ apps/
│  ├─ api/            NestJS + Prisma (prisma/schema.prisma, src/modules/*)
│  └─ web/            Next.js (dashboard, /tienda/[slug])
├─ packages/
│  ├─ shared/         tipos y helpers compartidos
│  └─ widget/         widget embebible (embed.js + widget.html)
├─ infra/
│  └─ docker-compose.yml
├─ docs/
└─ .github/workflows/ci.yml
```

## Instalación local

Requisitos: Node 22+, Docker.

```bash
# 1. Dependencias
npm install

# 2. Servicios (Postgres en 5433, Redis en 6379, S3 en 9000/9001)
docker compose -f infra/docker-compose.yml up -d

# 3. Variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Base de datos
npm run db:migrate          # aplica migraciones y genera el cliente Prisma
npm run seed                # crea el tenant demo "chronos-watches"

# 5. Widget (una vez; la API lo sirve en /widget-assets/)
npm run build:widget

# 6. Desarrollo
npm run dev
```

- Web: http://localhost:3000 — storefront demo: http://localhost:3000/tienda/chronos-watches — panel: http://localhost:3000/dashboard
- API: http://localhost:3001 — Swagger: http://localhost:3001/api/docs — salud: http://localhost:3001/health

Usuario demo: `admin@chronoswatches.com` / `admin12345` · Clave de widget demo: `wk_demo_chronos` (dominios `localhost`, `127.0.0.1`).

### Probar el chat en 1 minuto

```bash
# Simulador (con traza de herramientas), usando el token de login:
curl -s -X POST localhost:3001/ai/simulate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"¿Cuánto cuesta el Diver Pro?"}' | jq '.reply, .trace.tools[].name'
```

O crea un `index.html` con `<script src="http://localhost:3001/widget-assets/embed.js" data-key="wk_demo_chronos" async></script>`
y ábrelo con `python3 -m http.server 8088`. Sin `GEMINI_API_KEY` la API usa el proveedor **mock**
(determinista, sin costo) que ya ejecuta las herramientas reales; con clave, `AI_PROVIDER=gemini`.

> Si el puerto 5433 está ocupado: `POSTGRES_PORT=5434 docker compose -f infra/docker-compose.yml up -d`
> y ajusta `DATABASE_URL` en `apps/api/.env`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | API + web en modo desarrollo |
| `npm run build` | Compila API y web |
| `npm run lint` / `npm run typecheck` | Lint y tipos en todos los workspaces |
| `npm run build:widget` | Compila `embed.js` y `widget.html` |
| `npm test` | Pruebas unitarias de la API (Vitest) |
| `npm run test:e2e` | Pruebas e2e de la API contra Postgres (requiere `db:migrate`) |
| `npm run db:migrate` | `prisma migrate dev` (desarrollo) |
| `npm run db:deploy` | `prisma migrate deploy` (producción/CI) |
| `npm run db:studio` | Prisma Studio |
| `npm run seed` | Datos demo |

## Variables de entorno

### API (`apps/api/.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión Postgres (obligatoria) |
| `REDIS_URL` | Redis (colas/cache, Fase 1) |
| `JWT_SECRET` | Mínimo 32 caracteres; valores de desarrollo se rechazan en `NODE_ENV=production` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL_DAYS` | Vida del access token (15m) y del refresh (7 días) |
| `FRONTEND_URL` | Origen permitido en CORS |
| `S3_*` | Almacenamiento de archivos (Fase 1) |
| `AI_PROVIDER` | `disabled` (mock) · `gemini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL_SMALL`, `GEMINI_MODEL_LARGE`, `GEMINI_MODEL_EMBEDDING` | Proveedor Gemini; nombres de modelo configurables (defaults: `gemini-2.5-flash`, `gemini-2.5-pro`, `text-embedding-004`; verifica disponibilidad en tu consola) |
| `EMBEDDING_DIMENSIONS` | 768 por defecto (bloque 1.3) |
| `WIDGET_ASSETS_DIR` | Carpeta con el build del widget si no es `packages/widget/dist` |

### Web (`apps/web/.env.local`)

- `NEXT_PUBLIC_API_URL` — URL pública de la API.

## Seguridad y multi-tenancy (Fase 0)

- Todo recurso lleva `tenantId`; se deriva **siempre** del JWT, nunca del body (`forbidNonWhitelisted`).
- No existe listado global de tenants. `GET /catalog/public/:slug` filtra por el comercio del slug.
- Roles efectivos (`OWNER`, `ADMIN`, `AGENT`) con `RolesGuard`.
- Access token corto + refresh token opaco con hash en BD, rotación y revocación (`/auth/refresh`, `/auth/logout`).
- Rate limiting global (100/min) y estricto en `/auth/*` (5/min) y creación de pedidos (5/min).
- Configuración validada con `zod` al arrancar; la API no inicia sin `DATABASE_URL`/`JWT_SECRET` válidos.
- Pedidos: reserva de stock condicional dentro de una transacción (no hay stock negativo bajo concurrencia).
- Precios en **centavos enteros** (`priceCents`) para compatibilidad con pasarelas.

## Despliegue

Resumen: **web en Vercel** (Root Directory `apps/web`, variable `NEXT_PUBLIC_API_URL`), **API en
Railway/Render con `apps/api/Dockerfile`** (contexto: raíz del repo; aplica migraciones al arrancar y
sirve el widget), Postgres gestionado con `pgvector`. No despliegues la API en Vercel (SSE y estado en
proceso). Guía paso a paso: [docs/guia-despliegue.md](./docs/guia-despliegue.md).

```bash
docker build -f apps/api/Dockerfile -t smartcommerce-api .
docker run -p 3001:3001 -e DATABASE_URL=... -e JWT_SECRET=... -e FRONTEND_URL=https://tu-web smartcommerce-api
```

## Troubleshooting

- `Configuración inválida: JWT_SECRET...` → genera uno con `openssl rand -hex 32`.
- `P1001 Can't reach database` → revisa `docker compose ps` y `DATABASE_URL` (puerto 5433 por defecto).
- Error CORS → `FRONTEND_URL` debe coincidir con el origen del navegador.
- Prisma Client desactualizado tras cambiar `schema.prisma` → `npm run db:generate --workspace apps/api`.
