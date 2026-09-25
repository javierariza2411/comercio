# SmartCommerce

SmartCommerce es una plataforma SaaS multi-tenant para comercios que necesitan resolver consultas repetitivas sin depender de WhatsApp como centro de atención.

## Stack

- Frontend: Next.js + TypeScript + App Router + Tailwind CSS + shadcn/ui
- Backend: NestJS + TypeScript + REST + Swagger + JWT + Passport
- Database: MongoDB + Mongoose
- Deployment: Vercel + Railway + MongoDB Atlas

## Monorepo

```text
smartcommerce/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  └─ shared/
├─ .env.example
├─ package.json
├─ README.md
└─ .gitignore
```

## Instalación local

1. Clona el repositorio.
2. Instala dependencias:

```bash
npm install
```

3. Copia y configura variables de entorno:

```bash
cp .env.example .env
```

4. Si usas Mongo local, asegúrate de tener MongoDB corriendo.
5. Inicia frontend y backend:

```bash
npm run dev
```

Esto levantará:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

## Variables de entorno

### Backend
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `AI_PROVIDER`
- `GEMINI_API_KEY`
- `NODE_ENV`

### Frontend
- `NEXT_PUBLIC_API_URL`

## Seed

```bash
npm run seed
```

Este comando crea la demo de Chronos Watches con categorías, productos, FAQ y configuración base.

## Usuarios demo

Se recomienda crear un usuario admin y luego autenticarte en la API con tus credenciales.

## Deploy en Railway

1. Crea una nueva app en Railway.
2. Conecta el repositorio GitHub.
3. Usa la carpeta `apps/api` como servicio de la app.
4. Configura las variables de entorno del backend.
5. El comando de inicio debe apuntar a `npm run start --workspace apps/api` o al build generado por NestJS.
6. Configura la base MongoDB Atlas y usa su URI en `MONGODB_URI`.
7. Asegúrate de que `FRONTEND_URL` apunte a tu frontend en Vercel.

## Deploy en Vercel

1. Crea un proyecto en Vercel.
2. Conecta el mismo repositorio GitHub.
3. Selecciona la carpeta del frontend: `apps/web`.
4. Configura `NEXT_PUBLIC_API_URL` con la URL pública del backend en Railway.
5. Haz deploy.
6. Verifica que CORS y rutas públicas funcionen correctamente.

## Swagger

La documentación API queda disponible en:

```text
http://localhost:3001/api/docs
```

## Troubleshooting

- Error de conexión a MongoDB: revisa `MONGODB_URI`.
- Error de CORS: revisa `FRONTEND_URL` y `CORS` en la API.
- Error de JWT: revisa `JWT_SECRET` y `JWT_EXPIRES_IN`.
- Frontend no conecta con API: revisa `NEXT_PUBLIC_API_URL`.

## Siguiente fase

La siguiente etapa incluye:
- schemas Mongoose completos
- usuarios y multi-tenancy
- catálogo genérico
- chatbot con reglas
- lead scoring
- storefront institucional
- dashboard
- WhatsApp redirect

## Nota

Este repositorio representa la base del monorepo y la configuración crítica de despliegue para empezar el MVP real de SmartCommerce.
