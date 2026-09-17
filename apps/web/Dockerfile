#syntax=docker/dockerfile:1

# Next.js 16 dashboard image. Builds a standalone output and serves it with
# the built-in Node server (Phase 15).

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev -w apps/web

FROM base AS builder
WORKDIR /app

# Next inlines NEXT_PUBLIC_* into the client bundle at build time, so these have
# to be present here — passing them as runtime `environment:` never reaches the
# browser, and the dev seam silently sends no x-tenant-id header.
# Defaults mirror the zod schema in src/lib/env.ts. They cannot be left empty:
# `.default()` only fills an *undefined* value, so an empty string reaches
# `.email()` and fails the build with "Invalid email address".
ARG NEXT_PUBLIC_API_BASE=/backend
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_DEV_TENANT_ID=
ARG NEXT_PUBLIC_LEGAL_BUSINESS_NAME="Wakeel Technologies (Pvt) Ltd"
ARG NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=privacy@wakeel.pk
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_DEV_TENANT_ID=$NEXT_PUBLIC_DEV_TENANT_ID \
    NEXT_PUBLIC_LEGAL_BUSINESS_NAME=$NEXT_PUBLIC_LEGAL_BUSINESS_NAME \
    NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=$NEXT_PUBLIC_LEGAL_CONTACT_EMAIL

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci -w apps/web
COPY apps/web ./apps/web
RUN cd apps/web && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
# In a workspace, Next's standalone output preserves the monorepo layout, so
# the entrypoint is apps/web/server.js — not server.js at the root — and the
# server resolves `public` and `.next/static` relative to itself. Copying them
# to /app left the image unable to start at all:
#   Error: Cannot find module '/app/server.js'
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["dumb-init", "node", "apps/web/server.js"]
