# SmartCommerce — Arquitectura objetivo

> Entregable 2. Versión 1.0 (Fase 0). Este documento se actualiza al cierre de cada fase.

## 1. Visión

SaaS multi-tenant de chat web para comercios. Un comercio instala un widget con una línea de
script, carga su conocimiento (FAQ, políticas, documentos, catálogo) y el bot resuelve la mayoría
de las consultas desde la web. WhatsApp queda como canal opcional de escalamiento.

Supuestos adoptados (confirmados por omisión en el PASO 0):

| Tema | Decisión |
|---|---|
| Base de datos | PostgreSQL 16 + `pgvector`, acceso con Prisma |
| LLM por defecto | Gemini (adaptador multi-proveedor: Gemini / OpenAI / Anthropic) |
| Pagos de suscripción | Wompi, en Fase 2 (planes asignados a mano en el MVP) |
| Storefront `/tienda/[slug]` | Módulo opcional, no core |
| Pedidos por transferencia | Se conservan |
| Agentes por comercio | 1–3 (inbox simple, sin enrutamiento complejo) |
| Despliegue | Vercel (web) + Railway (api + workers) en prod; Docker Compose en local |
| Idioma | Solo español en el MVP |

## 2. Diagrama de componentes

```mermaid
flowchart LR
  subgraph Sitio del comercio
    L[embed.js loader ~2 KB] --> W[Widget en iframe<br/>Preact + Vite, menos de 50 KB]
  end
  subgraph Plataforma
    W -- REST + SSE --> API[NestJS API]
    P[Panel admin + Inbox agentes<br/>Next.js] -- REST + SSE --> API
    API --> DB[(PostgreSQL + pgvector)]
    API --> R[(Redis: cache, colas, pub/sub)]
    API --> S3[(S3 compatible: R2 prod / MinIO local)]
    WK[Workers BullMQ<br/>ingesta, embeddings, PDF, webhooks, notificaciones] --> DB
    WK --> S3
    R --> WK
    API --> LLM[Adaptador LLM]
    WK --> LLM
    API -.opcional.-> WA[WhatsApp Cloud API]
    API -.Fase 2.-> BILL[Wompi]
  end
```

### Monorepo

```text
smartcommerce/
├─ apps/
│  ├─ api/          NestJS (REST + SSE + workers BullMQ en el mismo proceso en MVP)
│  └─ web/          Next.js: landing, panel admin, inbox de agentes, storefront opcional
├─ packages/
│  ├─ shared/       tipos, enums y constantes compartidos (api, web, widget)
│  └─ widget/       Fase 1: loader + app del widget (Preact + Vite)
├─ infra/
│  └─ docker-compose.yml   Postgres(pgvector), Redis, MinIO
└─ docs/
```

## 3. Multi-tenancy y seguridad

- **Aislamiento por `tenantId`** en todas las tablas de negocio. Nunca se acepta `tenantId` desde
  el body: se deriva del JWT (panel) o de la **widget key** (widget).
- **Widget key** pública por tenant con *allowlist* de dominios. El widget la envía en el header
  `X-Widget-Key`; el servidor valida `Origin` contra la allowlist y emite un token de visitante.
- **Autenticación del panel**: access token JWT corto (15 min) + refresh token opaco (7 días)
  almacenado con hash en BD y rotación en cada uso. Logout revoca el refresh token.
- **Roles** (`RolesGuard`): `OWNER`, `ADMIN`, `AGENT`. `SUPER_ADMIN` es un rol de plataforma
  separado (operación del SaaS), no de tenant.
- **Rate limiting** global (`@nestjs/throttler`) y límites estrictos en `/auth/*`, creación de
  pedidos y mensajes del widget.
- **Validación**: DTOs con `class-validator`, `whitelist` + `forbidNonWhitelisted`. Config del
  proceso validada con `zod` al arrancar (falla rápido si falta `JWT_SECRET` en producción).
- **Archivos**: validación de MIME por *magic bytes*, límite de tamaño por plan, nombres
  aleatorios, bucket privado con URLs firmadas.
- **Guardrails de IA**: el prompt del sistema está fuera del alcance del usuario; el contexto RAG
  se filtra por tenant; se rechazan temas fuera del negocio; respuesta de "no sé" cuando la
  similitud máxima está bajo umbral; límite de tokens por conversación y por plan.
- **Auditoría** (Fase 3): tabla `AuditLog` de cambios de configuración y acciones de agentes.
- **Privacidad**: consentimiento explícito antes de guardar datos personales (Ley 1581/2012),
  retención configurable por tenant y endpoint de supresión por correo/teléfono (Fase 3).

## 4. Modelo de datos

Convenciones: `id` UUID, `createdAt`/`updatedAt`, `tenantId` indexado en toda tabla de negocio.
Precios en **centavos enteros** (`Int`) con `currency` ISO; evita errores de coma flotante.

### 4.1 Núcleo (Fase 0 — implementado)

| Tabla | Campos principales | Notas |
|---|---|---|
| `Tenant` | `name`, `slug` único, `description`, `logoUrl`, `phone`, `whatsappNumber`, `email`, `businessType`, `settings` (JSON: currency, locale, timezone), `branding` (JSON), `chatSettings` (JSON), `paymentSettings` (JSON), `plan` | `name` **no** es único |
| `User` | `tenantId`, `name`, `email` único, `passwordHash`, `role` (OWNER/ADMIN/AGENT), `status` | Un usuario pertenece a un tenant |
| `RefreshToken` | `userId`, `tokenHash`, `expiresAt`, `revokedAt` | Rotación en cada refresh |
| `Category` | `tenantId`, `name`, `slug`, `order`, `active` | Único `(tenantId, slug)` |
| `Product` | `tenantId`, `categoryId?`, `type`, `name`, `slug`, `shortDescription`, `description`, `priceCents`, `compareAtPriceCents?`, `currency`, `images[]`, `stock`, `trackStock`, `active`, `featured`, `attributes` JSON, `tags[]` | Único `(tenantId, slug)` |
| `ProductVariant` | `tenantId`, `productId`, `name`, `sku?`, `priceCents?`, `stock`, `attributes` JSON, `active` | |
| `Faq` | `tenantId`, `question`, `answer`, `keywords[]`, `active`, `order` | Fuente de conocimiento prioritaria |
| `Order` | `tenantId`, `orderNumber` único, `items` JSON, `customer` JSON, `totalCents`, `currency`, `paymentMethod`, `status`, `paidAt?` | Decrementa stock en transacción |

### 4.2 Chat, conocimiento y atención (Fase 1)

| Tabla | Campos principales |
|---|---|
| `WidgetKey` | `tenantId`, `key` único, `allowedDomains[]`, `active` |
| `Visitor` | `tenantId`, `anonId`, `leadId?`, `metadata` JSON (userAgent, página, UTM) |
| `Conversation` | `tenantId`, `visitorId`, `channel` (WEB/WHATSAPP), `status` (BOT/WAITING_AGENT/WITH_AGENT/CLOSED), `assigneeId?`, `tags[]`, `lastMessageAt`, `botTokensUsed`, `csat?` |
| `Message` | `tenantId`, `conversationId`, `role` (VISITOR/BOT/AGENT/SYSTEM), `type` (TEXT/IMAGE/FILE/PRODUCT_CARD/CAROUSEL/QUICK_REPLIES/FORM), `content` JSON, `meta` JSON (intención, fuentes, tokens, modelo) |
| `KnowledgeSource` | `tenantId`, `type` (FAQ/TEXT/PDF/XLSX/CSV/URL/CATALOG), `title`, `assetId?`, `url?`, `status` (PENDING/PROCESSING/READY/ERROR), `chunkCount`, `error?` |
| `KnowledgeChunk` | `tenantId`, `sourceId`, `content`, `embedding vector(768)`, `tsv tsvector`, `meta` JSON | Índices: HNSW en `embedding`, GIN en `tsv`, `(tenantId, sourceId)` |
| `Asset` | `tenantId`, `bucketKey`, `mime`, `sizeBytes`, `kind` (IMAGE/PDF/DOC/IMPORT), `publicUrl?` |
| `Lead` | `tenantId`, `visitorId?`, `conversationId?`, `name`, `email`, `phone`, `consentAt`, `consentText`, `consentIp`, `status`, `source`, `interestedProductIds[]` |
| `CannedResponse` | `tenantId`, `shortcut`, `title`, `body` |
| `InternalNote` | `tenantId`, `conversationId`, `authorId`, `body` |
| `BusinessHours` | `tenantId`, `weekday`, `open`, `close`, `timezone` + `offHoursMessage` en `Tenant.chatSettings` |
| `UsageCounter` | `tenantId`, `period` (YYYY-MM), `conversations`, `aiMessages`, `storageBytes`, `agents` |
| `AnalyticsEvent` | `tenantId`, `type`, `conversationId?`, `productId?`, `payload` JSON, `occurredAt` |

### 4.3 Comercial e integraciones (Fases 2–3)

`Plan` (límites), `Subscription` (Wompi), `Invoice`, `Webhook` (url, eventos, secreto),
`WebhookDelivery`, `Flow` (JSON de pasos guiados), `AuditLog`, `WhatsAppConnector`,
`ApiKey` (API pública de estado de pedidos), `Reseller` (marca blanca).

## 5. API (REST, prefijo `/api/v1` a partir de Fase 1)

### Fase 0 (implementada)

| Método y ruta | Auth | Descripción |
|---|---|---|
| `POST /auth/register` | — | Crea tenant + usuario OWNER; devuelve access + refresh |
| `POST /auth/login` | — | Devuelve access + refresh |
| `POST /auth/refresh` | refresh | Rota el refresh token |
| `POST /auth/logout` | refresh | Revoca el refresh token |
| `GET /auth/me` | JWT | Usuario actual |
| `GET /tenants/me` | JWT | Tenant del usuario |
| `PATCH /tenants/me` | OWNER/ADMIN | Nombre, descripción, contacto, branding, settings, chatSettings |
| `PATCH /tenants/me/payment-settings` | OWNER/ADMIN | Datos de transferencia bancaria |
| `GET /tenants/public/:slug` | — | Datos públicos del tenant (sin cuenta bancaria si no está configurada) |
| `GET /catalog/public/:slug` | — | Catálogo público del tenant (**filtrado por tenant**) |
| `GET/POST /catalog/categories`, `PATCH/DELETE /catalog/categories/:id` | JWT | CRUD de categorías del tenant |
| `GET/POST /catalog/products`, `GET/PATCH/DELETE /catalog/products/:id` | JWT | CRUD de productos del tenant |
| `GET/POST /faq`, `PATCH/DELETE /faq/:id` | JWT | CRUD de FAQ |
| `POST /faq/search` | JWT | Búsqueda textual (sin regex sobre entrada del usuario) |
| `POST /orders/:slug/bank-transfer` | — (throttled) | Crea pedido y reserva stock en transacción |
| `GET /orders` | JWT | Pedidos del tenant |
| `PATCH /orders/:orderNumber/confirm-transfer` | OWNER/ADMIN | Marca como pagado |
| `GET /health` | — | Liveness + estado de BD |

### Fase 1 (a implementar)

- Widget (header `X-Widget-Key`): `POST /widget/session`, `GET /widget/config`,
  `POST /widget/conversations/:id/messages`, `GET /widget/conversations/:id/events` (SSE),
  `POST /widget/leads`, `POST /widget/conversations/:id/handoff`.
- Conocimiento: `POST /knowledge/sources` (multipart o URL/texto), `GET /knowledge/sources`,
  `DELETE /knowledge/sources/:id`, `POST /knowledge/test` (pregunta de prueba).
- Inbox: `GET /inbox/conversations?status=`, `GET /inbox/conversations/:id`,
  `POST /inbox/conversations/:id/messages`, `PATCH /inbox/conversations/:id` (asignar, estado,
  etiquetas), `GET /inbox/events` (SSE), `CRUD /inbox/canned-responses`, `POST /inbox/conversations/:id/notes`.
- Catálogo: `POST /catalog/import` (CSV/XLSX), `POST /assets` (upload), `GET /catalog/pdf`.
- Analítica: `GET /analytics/overview?from&to`, `GET /analytics/unanswered`, `GET /analytics/top-products`.
- Plantillas: `GET /templates`, `POST /tenants/me/apply-template/:id`.

## 6. Flujo de un mensaje del widget (Fase 1)

1. Widget `POST /widget/conversations/:id/messages` con el texto.
2. API guarda `Message(VISITOR)`, publica evento SSE y encola `ProcessMessageJob`.
3. Worker: (a) verifica límites del plan y presupuesto de tokens de la conversación;
   (b) detecta intención (LLM barato con salida JSON: `product_query`, `price`, `shipping`,
   `complaint`, `buy`, `human`, `lead`, `other`); (c) si la intención es `human` o la
   conversación está `WITH_AGENT`, no responde el bot; (d) recupera contexto: FAQ por
   similitud + `KnowledgeChunk` híbrido (vector + full-text) + productos por búsqueda textual,
   todo filtrado por `tenantId`; (e) si la mejor similitud está bajo umbral → mensaje de
   "no tengo esa información" + quick replies "Hablar con una persona" / "Dejar mis datos";
   (f) si hay productos relevantes → `PRODUCT_CARD`/`CAROUSEL`; (g) llama al LLM con prompt
   del sistema del tenant (tono, nombre, reglas) + contexto + últimos N mensajes; (h) guarda
   `Message(BOT)` con `meta` (fuentes, tokens, modelo) y publica SSE.
4. Caché: hash de (tenantId, pregunta normalizada, versión de la KB) → respuesta, TTL 24 h.

## 7. Decisiones técnicas (ADR resumidos)

| # | Decisión | Alternativas | Justificación |
|---|---|---|---|
| 1 | PostgreSQL + pgvector + Prisma | Mongo + Atlas Vector Search | Transacciones (stock, pedidos, facturación), vector + full-text en un motor, local trivial, RLS posible, hosting barato |
| 2 | Widget = loader + iframe | Shadow DOM en el host | Aislamiento total CSS/JS, CSP estricta, 2 KB en el sitio del cliente |
| 3 | Preact + Vite para el widget | React, Svelte | <50 KB con JSX conocido; sin dependencia del bundle del panel |
| 4 | SSE en vez de WebSocket | Socket.IO | Pasa por cualquier CDN/proxy, reconexión nativa, servidor stateless; Redis pub/sub al escalar |
| 5 | Adaptador LLM propio | SDK de un solo proveedor | Cambiar proveedor por tenant/plan y comparar costos; evita lock-in |
| 6 | BullMQ (Redis) para trabajos | Procesar en request | Ingesta de PDF y embeddings son lentos; reintentos y backpressure |
| 7 | Precios en centavos enteros | Decimal | Sin errores de redondeo; compatible con pasarelas |
| 8 | Workers en el mismo proceso en MVP | Servicio separado | Simplicidad; se separa con una variable de entorno cuando haga falta |

## 8. Costos estimados (verificar contra listas de precios vigentes)

Supuestos: 6 turnos de usuario por conversación; ~2.500 tokens de entrada y ~150 de salida por
turno; 30 % de turnos resueltos por caché/FAQ directa sin LLM.

| Concepto | Por 1.000 conversaciones | Nota |
|---|---|---|
| LLM Gemini Flash | ≈ US$ 1,5 – 3 | Entrada ≈ US$0,10/M tokens, salida ≈ US$0,40/M |
| LLM GPT-4o-mini | ≈ US$ 2 – 4 | |
| LLM Claude Haiku | ≈ US$ 10 – 15 | Usar solo si el tenant lo paga (plan Empresa) |
| Embeddings (ingesta) | < US$ 0,1 | Una vez por documento |
| Infra base compartida | US$ 30 – 60 / mes | API+workers (Railway ~US$10–20), Postgres gestionado (US$0–19), Redis (US$0–10), R2 (US$0), Vercel (US$0–20) |

Palancas de ahorro: FAQ directa cuando la similitud > 0,9; caché semántica; modelos "flash";
truncado de historial; límites por plan; preferir `PRODUCT_CARD` generados desde BD en lugar de
texto del LLM.

Comparativo: una conversación de WhatsApp Business API cuesta del orden de US$0,01–0,03 en
Colombia según categoría (verificar), es decir **US$10–30 por 1.000 conversaciones**, 5–10× el
costo de IA del chat web.

## 9. Despliegue

- **Local**: `docker compose -f infra/docker-compose.yml up -d` (Postgres, Redis, MinIO) +
  `npm run dev`.
- **Producción (referencia)**: Vercel para `apps/web`; Railway para `apps/api` (y un segundo
  servicio con `WORKER_MODE=true` cuando haga falta); Postgres gestionado con extensión
  `vector` (Neon, Supabase, Railway); Upstash o Railway Redis; Cloudflare R2.
- **CI**: GitHub Actions: lint, typecheck, test unitario; e2e contra Postgres de servicio.
