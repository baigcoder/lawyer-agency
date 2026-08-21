#syntax=docker/dockerfile:1

# Backend image — one image, three roles (api|worker|voice) per D-013 / D-124.
# Build context must be the repo root so the lockfile and workspace structure
# are available.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev -w apps/api

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci -w apps/api
COPY infra/scripts/migrate.sh /app/infra/scripts/migrate.sh
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate && npm run build

# One-off migration runner — needs dev deps (Prisma CLI), unlike the slim runner.
FROM builder AS migrator
WORKDIR /app/apps/api
CMD ["sh", "/app/infra/scripts/migrate.sh"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init espeak-ng ffmpeg
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Prisma client is generated into src/generated; compiled JS in dist references
# it via relative paths, so copy it next to dist/ for runtime resolution.
COPY --from=builder /app/apps/api/src/generated ./apps/api/dist/generated
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Role is selected at runtime via API_ROLE (api|worker|voice).
WORKDIR /app/apps/api
EXPOSE 3001
EXPOSE 5060/udp
CMD ["dumb-init", "node", "dist/main.js"]
