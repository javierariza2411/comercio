# syntax=docker/dockerfile:1
# Imagen de producción de la API (incluye el build del widget, que la API sirve en /widget-assets).
# Build desde la RAÍZ del monorepo:  docker build -f apps/api/Dockerfile -t smartcommerce-api .

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/widget/package.json packages/widget/
# --ignore-scripts: el postinstall (build de shared) se ejecuta en la etapa de build con el código ya copiado
RUN npm ci --ignore-scripts

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/widget packages/widget
COPY apps/api apps/api
RUN npm run build --workspace packages/shared \
 && npm run build --workspace packages/widget \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace apps/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Instala solo lo necesario para ejecutar la API (Prisma CLI queda incluido para migrate deploy).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/widget/package.json packages/widget/
RUN npm ci --omit=dev --ignore-scripts --workspace apps/api --workspace packages/shared
# `npm ci --ignore-scripts` no genera Prisma Client; reutilizamos el cliente generado en build.
COPY --from=build /repo/node_modules/@prisma/client node_modules/@prisma/client
COPY --from=build /repo/node_modules/@prisma/engines node_modules/@prisma/engines
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/widget/dist packages/widget/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/dist apps/api/dist
ENV WIDGET_ASSETS_DIR=/repo/packages/widget/dist
EXPOSE 3001
USER node
# Aplica migraciones pendientes y arranca. Koyeb no necesita un comando aparte.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main"]
