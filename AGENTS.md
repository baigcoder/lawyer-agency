# AGENTS.md — Project context for agent sessions

**Project:** Multi-tenant SaaS ("Wakeel") — AI WhatsApp legal assistant for law firms in Pakistan. Clients use WhatsApp only; firm staff use this dashboard. AI intakes/triages/summarizes and never gives legal advice.

## Read first
1. `docs/decision-log.md` — every architectural/product decision (D-001…), with rejected alternatives. Recap section at top is current state.
2. `docs/phases/` — one document per phase (requirements → architecture → schema → backend → frontend …). The latest phase doc describes the current build state.

## Hard rules (violations break the product's core guarantees)
- **Tenant isolation is DB-enforced** (RLS + FORCE, `app.tenant_id` GUC per transaction via `UnitOfWork.withTenant`). App-level filters are defense-in-depth only. Never query tenant tables outside the UoW.
- **Module boundaries:** a module imports another module's *exported application service* only — never its internals (enforced by root `eslint.config.mjs`; domain layers import no NestJS/Prisma/vendor code).
- **Events** go through the transactional outbox (`OutboxWriter` inside the same tx); payloads are T1/T2 only (identifiers/statuses — never message bodies or documents).
- **24h WhatsApp window:** proactive sends outside the window must use approved templates (D-003).
- **AI data posture:** T1/T2/T3 tiers (D-005); T3 (documents, transcripts, IDs) never leaves for third-party LLMs by default.
- **No `any`, no unchecked casts;** zod-validate all boundary input (backend pipe + frontend client/forms).
- **No git mutations** (commit/push) unless the user explicitly asks.

## Stack (current, deliberate)
- `apps/api`: NestJS 11, Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`; client generated into `src/generated`), PostgreSQL 16 + pgvector, Redis + BullMQ. One image, roles `api|worker|voice` (`API_ROLE`; `voice` is the WhatsApp receptionist: Cloud Calling WebRTC, QR/Baileys via Wavoip or missed-call chat, D-124).
- `apps/web`: Next.js 16 (App Router, `proxy.ts` convention), React 19, Tailwind v4, shadcn/ui on **Base UI** (`render` prop, not `asChild`), TanStack Query, RHF+zod, Clerk v7 (env-gated dev seam when keys absent).
- WhatsApp transport: **Evolution API** (self-hosted) is the sole transport layer; it hosts Baileys and Cloud API instances per tenant. Wakeel connects to Evolution via REST and consumes its webhooks. The legacy in-house Baileys pilot bridge and direct Meta Cloud API integration are removed from active wiring.
- Web talks to API only via same-origin `/backend/*` rewrites (no CORS anywhere).

## Commands
```bash
npm install                      # workspaces: apps/api + apps/web
docker compose up -d             # postgres+pgvector, redis, evolution-api+postgres+redis, migrate, seed, api, worker, voice
                                 # seed provisions the dev seam tenant automatically
npm run build                    # both apps (docker images are built from dist)
cd apps/api && npx vitest run    # backend unit tests
npx eslint "src/**/*.ts"         # from apps/api — includes boundary rules
# After refactors/file moves: verify with full type-check (incremental nest
# build can mask errors via stale tsbuildinfo):
cd apps/api && npx tsc -p tsconfig.build.json --noEmit
# Production-like containers (Phase 15):
docker compose -f docker-compose.prod.yml up -d migrate  # run migrations once
docker compose -f docker-compose.prod.yml up -d          # api, worker, web, nginx
curl http://localhost/health                              # orchestrator health
```

## Environment
Copy `.env.example` → `apps/api/.env` and `apps/web/.env.local`. Config is zod-validated at boot and fails fast. `MASTER_ENCRYPTION_KEY` must be 64 hex chars. Without Clerk keys, both apps run the dev seam (backend `x-tenant-id` header = `NEXT_PUBLIC_DEV_TENANT_ID`). The dev seam tenant (`NEXT_PUBLIC_DEV_TENANT_ID`) is seeded automatically by the `seed` service when the stack starts.

For a step-by-step key-acquisition guide (Clerk, Meta/WhatsApp, OpenAI, Anthropic, Google, Supabase, VAPID, SMTP, Sentry, etc.), see `docs/ENV_SETUP.md`.

## Workflow
Phases build in order (see `docs/phases/`); each phase ends with decision-log updates. Current state: Phases 1–15 complete. Post-MVP: Evolution API WhatsApp transport (D-106), AI auto-reply toggle (D-107), Supabase document storage + RAG (D-108), Google Calendar sync with WhatsApp appointment confirmations (D-109), and production RBAC (owner vs invited lawyer, D-116) are implemented. Next: post-MVP operations/backlog (hosting target, backups, alerting, staging smoke tests).
