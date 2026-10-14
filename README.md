# SmartCommerce

Plataforma SaaS multi-tenant de **chat web para comercios**: cada negocio instala un widget en su
página, carga su conocimiento (FAQ, políticas, catálogo, documentos) y el bot resuelve la mayoría
de las consultas desde la web. WhatsApp queda como canal opcional de escalamiento.

- [docs/arquitectura.md](./docs/arquitectura.md) — arquitectura objetivo, modelo de datos, API, decisiones y costos.
- [docs/backlog-mvp.md](./docs/backlog-mvp.md) — historias de usuario con criterios de aceptación.

## Estado

| Fase | Estado |
|---|---|
| 0 · Saneamiento (seguridad, multi-tenant, Postgres/Prisma, tests, CI, Docker) | ✅ Completa |
| 1 · MVP vendible (widget, chat + RAG, conocimiento, catálogo, handoff, panel) | ⏳ Siguiente |
| 2 · Monetización (planes, Wompi, onboarding por URL, analítica avanzada) | Pendiente |
| 3 · Escala (WhatsApp, 2FA, auditoría, marca blanca, observabilidad) | Pendiente |

## Stack

- **API**: NestJS 12 (ESM) · Prisma 6 · PostgreSQL 16 + pgvector · Redis · JWT (access + refresh rotativo) · Throttler · Swagger
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
│  └─ shared/         tipos y helpers compartidos
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

# 5. Desarrollo
npm run dev
```

- Web: http://localhost:3000 — storefront demo: http://localhost:3000/tienda/chronos-watches — panel: http://localhost:3000/dashboard
- API: http://localhost:3001 — Swagger: http://localhost:3001/api/docs — salud: http://localhost:3001/health

Usuario demo: `admin@chronoswatches.com` / `admin12345`.

> Si el puerto 5433 está ocupado: `POSTGRES_PORT=5434 docker compose -f infra/docker-compose.yml up -d`
> y ajusta `DATABASE_URL` en `apps/api/.env`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | API + web en modo desarrollo |
| `npm run build` | Compila API y web |
| `npm run lint` / `npm run typecheck` | Lint y tipos en todos los workspaces |
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
| `AI_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | IA (Fase 1) |

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

## Despliegue (referencia)

- **API** en Railway/Render: build `npm run build --workspace apps/api`, start `node apps/api/dist/main`,
  ejecutar `npm run db:deploy --workspace apps/api` en el release. Postgres gestionado con extensión `vector`.
- **Web** en Vercel: root `apps/web`, variable `NEXT_PUBLIC_API_URL`.
- Guía detallada de producción: pendiente para el cierre de la Fase 1.

## Troubleshooting

- `Configuración inválida: JWT_SECRET...` → genera uno con `openssl rand -hex 32`.
- `P1001 Can't reach database` → revisa `docker compose ps` y `DATABASE_URL` (puerto 5433 por defecto).
- Error CORS → `FRONTEND_URL` debe coincidir con el origen del navegador.
- Prisma Client desactualizado tras cambiar `schema.prisma` → `npm run db:generate --workspace apps/api`.
