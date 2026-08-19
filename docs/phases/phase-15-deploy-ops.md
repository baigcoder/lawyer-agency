# Phase 15 — Deploy & Ops

**Goal:** Package the Wakeel monorepo as production-ready containers and document the operational baseline (local compose, CI, hosting target, secrets, health checks).

## What is in scope

1. Container packaging
   - `apps/api/Dockerfile`: one image, two runtime roles (`API_ROLE=api|worker`) per D-013.
   - `apps/web/Dockerfile`: Next.js 16 standalone output served by the built-in Node server.
   - Root `.dockerignore` to keep build context small and secrets-free.

2. Orchestration
   - `docker-compose.prod.yml`: postgres+pgvector, Redis, migrate (run once), API, worker, web, NGINX.
   - `infra/nginx/nginx.conf`: same-origin `/backend/*` proxy; no CORS.
   - `infra/scripts/migrate.sh`: owner-role migration runner used by the migrate service.
   - `infra/postgres/init.sql`: creates the non-owner `app_user` and databases (dev/test/prod).

3. CI
   - `.github/workflows/ci.yml`: per-workspace jobs; API job runs migrations, build, type-check, lint, and tests against real Postgres/Redis services.

4. Documentation
   - Runtime env checklist (`.env.example` already covers keys).
   - Hosting target and first-run steps.

## What is NOT in scope

- Kubernetes / Terraform / ECS manifests. Coolify/Docker Compose is the v1 target.
- Full monitoring stack setup (only OTel/Sentry wiring and health endpoints are provided; Prometheus/Grafana/Loki provisioning is post-MVP).
- Automated production deploys / CD.

## Artifacts

| File | Purpose |
|------|---------|
| `apps/api/Dockerfile` | Multi-stage build; generates Prisma client, compiles NestJS, runs as `api` or `worker`. |
| `apps/web/Dockerfile` | Multi-stage build; outputs Next.js standalone server. |
| `.dockerignore` | Excludes node_modules, env files, .git, coverage. |
| `docker-compose.prod.yml` | Production-like local stack; `migrate` runs before API/worker start. |
| `infra/nginx/nginx.conf` | Reverse proxy: `/backend/*` → API, everything else → Next.js. |
| `infra/scripts/migrate.sh` | `npx prisma migrate deploy` against `MIGRATION_DATABASE_URL`. |
| `infra/postgres/init.sql` | Bootstrap `app_user`, `lawyer_agency`, `lawyer_agency_test`, `lawyer_agency_shadow`. |
| `.github/workflows/ci.yml` | Build + test gate. |
| `docs/phases/phase-15-deploy-ops.md` | This doc. |

## Runtime roles

The API image reads `API_ROLE`:

- `api` — HTTP server on `API_PORT` (default 3001).
- `worker` — BullMQ consumers only; no HTTP port exposed.

Both roles share domain code, Prisma client, and env config. The docker-compose file deploys two services from the same image.

## First run on a fresh host

1. Copy `.env.example` to `.env` and fill secrets (`MASTER_ENCRYPTION_KEY`, Clerk keys, Meta tokens, optional AI/observability keys).
2. Ensure `DATABASE_URL` points to `app_user` and `MIGRATION_DATABASE_URL` points to the owner role (`postgres`).
3. `docker compose -f docker-compose.prod.yml up -d migrate` — applies migrations.
4. `docker compose -f docker-compose.prod.yml up -d` — brings up API, worker, web, NGINX.
5. Health check: `curl http://localhost/health` (NGINX) or `curl http://localhost:3001/health` (API directly).

## CI behavior

On every push/PR to `main`:

- `apps/api`: install, generate Prisma client, run migrations against Postgres service, build, type-check, lint, run tests.
- `apps/web`: install, build.

Tests need a 64-hex-char `MASTER_ENCRYPTION_KEY` placeholder (provided in workflow env).

## Decisions added in this phase

- **D-086** — Container packaging: one backend image with runtime `API_ROLE=api|worker`, Next.js standalone frontend image, root npm-workspace build context. Rejected separate worker image and single all-in-one container.
- **D-087** — v1 orchestration: Docker Compose (Coolify-compatible) with explicit migrate-once service and NGINX reverse proxy. Rejected Kubernetes/ECS/PaaS lock-in for MVP.
- **D-088** — CI gate: GitHub Actions per-workspace jobs; API tested against real Postgres+Redis with migrations, type-check, lint, and unit tests. Rejected mono-job without migrations and split-repo pipelines.
- **D-089** — Runtime secrets only: env vars at runtime; separate `MIGRATION_DATABASE_URL` owner URL; no secrets baked into images. Rejected env files copied into images and app role running migrations.

## Verification checklist

- [ ] `npm run build` succeeds from repo root.
- [ ] `cd apps/api && npx tsc -p tsconfig.build.json --noEmit` succeeds.
- [ ] `cd apps/api && npx vitest run` succeeds.
- [ ] `docker compose -f docker-compose.prod.yml config` validates.
- [ ] `docker compose -f docker-compose.prod.yml build` succeeds (requires Docker daemon).
- [ ] `curl http://localhost/health` returns `{"status":"ok"}` after startup.

## Next steps (post-Phase 15)

- Choose a hosting provider (Coolify on Hetzner/DO is the recommended v1 path) and point DNS.
- Provision managed Postgres 16 + pgvector and managed Redis, or use the compose stack as-is.
- Add TLS termination (NGINX/certbot or provider load balancer).
- Configure backups, log shipping, and alerting.
- Optional: add a staging environment and smoke tests against `/health` and `/backend/health/ready` after deploy.
