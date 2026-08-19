# Phase 4 — Backend Architecture

**Status:** 4a + 4b delivered & verified 2026-08-12 · Phase 4 complete
**Split:** per the working agreement this phase was split — **4a: process skeleton + cross-cutting concerns** · **4b: domain module skeletons, Cases reference module, queue layer, boundary lint (complete)**

---

## 1. Goal & Definition of Done (4a)

**Goal:** A compiling, booting NestJS skeleton carrying every cross-cutting concern the brief demands from day one — validated config, structured logging, correlation, tenant context, RLS-bound persistence boundary, consistent errors.

**Done when (all verified, evidence below):**
- [x] Monorepo scaffold (npm workspaces), strict TS (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- [x] Env validated at boot with zod, fail-fast, no value echo
- [x] Prisma 7 service via `@prisma/adapter-pg`, connecting as non-owner `app_user`
- [x] UnitOfWork: `withTenant` pins `app.tenant_id` via `set_config(..., true)` (= SET LOCAL, pool-safe, bind-parameterized); `withPlatform` for infrastructure
- [x] Correlation middleware + AsyncLocalStorage context + pino with auth-header redaction
- [x] Global exception filter: consistent error shape, no 5xx leakage, correlation id on errors
- [x] Health split: dependency-free liveness, DB-checked readiness
- [x] One image, two roles (`API_ROLE=api|worker`) bootstrap

**Verification evidence (this environment):**
- `nest build` clean; `tsc --noEmit` clean under the strict flag set
- Boot with placeholder key → `Invalid environment configuration: MASTER_ENCRYPTION_KEY: must be 64 hex chars` (fail-fast works, value not echoed)
- Boot with valid env, no DB → listens on :3001; `GET /health` → 200; `GET /health/ready` → **503 `database unreachable`** (readiness correctly reflects dependency down; driver-adapter connections are lazy)
- `GET /v1/nope` with `x-correlation-id: test-corr-123` → 404 in the standard shape with `"correlationId": "test-corr-123"` echoed

## 2. Key Decisions & Trade-offs (4a)

### D-027 — Zod for backend validation (no class-validator)
One validation language across the stack (brief mandates Zod frontend): a small `ZodValidationPipe` applied per-handler with the DTO schema. Rejected: class-validator/class-transformer (decorator metadata is the implicit-any-prone path, and it duplicates a schema language); global auto-validation pipe (can't infer per-route schemas — per-handler application is explicit and typed).

### D-028 — AsyncLocalStorage context, entered exactly once
`RequestContextStore` entered only in `CorrelationMiddleware`; tenantId attached later by the auth guard (Phase 10) or webhook tenant resolution (Phase 6). Single entry point eliminates the ALS context-leak failure mode. Rejected: REQUEST-scoped NestJS providers for context (async provider chains notoriously break scope bubbling and cost performance); passing context as parameters through every layer (drilling, guarantees inconsistency).

### D-029 — PrismaService is the connection; UnitOfWork is the only access pattern
Repositories (4b) receive the UoW, never the raw client, so forgetting the RLS GUC is structurally impossible for tenant data. `withPlatform` exists for the two legitimate cross-tenant jobs (webhook inbox, outbox dispatcher) and its docblock marks tenant-data use as a design violation. Rejected: Prisma client extension auto-injecting tenant filters (app-layer only — the breach pattern the brief bans; also can't set the GUC for RLS); middleware-based `SET` per connection (breaks under pool checkout interleaving; transaction-scoped `set_config` is the correct granularity).

### D-030 — Generated Prisma client lives inside `src/generated`
Keeping it under `src/` keeps tsc `rootDir` stable so `dist/` mirrors `src/` 1:1 (an out-of-src output initially produced `dist/src/main.js` and broke the start script — caught by the smoke test, fixed structurally not by path-patching). Gitignored; regenerated in CI.

### D-031 — Health endpoints split and quiet
Liveness never touches dependencies (a DB blip must not restart healthy pods); readiness does. Health excluded from auto-logging (50% of log volume at probe intervals is noise). Rejected: single combined endpoint (conflates two different operational signals).

## 3. Folder/Module Structure (as built)

```
apps/api/
├── prisma/
│   ├── schema.prisma                    # 30 models, app + platform schemas
│   └── migrations/                      # 0001 generated · 0002 RLS · 0003 partitions/vector
├── prisma.config.ts                     # Prisma 7 config (owner URL for migrate)
├── src/
│   ├── main.ts                          # role=api|worker bootstrap
│   ├── app.module.ts                    # config/logger/prisma/health + filter + middleware
│   ├── config/env.ts                    # zod-validated env, fail-fast
│   ├── common/
│   │   ├── context/request-context.ts   # ALS store (correlationId, tenantId, userId)
│   │   ├── correlation/                 # middleware (header trust-charset + mint)
│   │   ├── prisma/                      # service (adapter-pg) + UnitOfWork + module
│   │   ├── pipes/zod-validation.pipe.ts
│   │   ├── filters/global-exception.filter.ts
│   │   └── health/                      # liveness + readiness
│   └── generated/prisma/                # gitignored client (regenerated in CI)
└── dist/                                # mirrors src/ 1:1
```

4b adds `src/modules/<module>/{domain,application,infrastructure,interface}` per the Phase 2 module map, plus `src/common/queue` (BullMQ) for the worker role.

## 4. Security Considerations (4a)

- Env validation never echoes values; auth/cookie headers redacted from logs; correlation header accepted only through a strict charset (it flows to logs/downstream headers).
- 5xx responses carry no internals; 4xx carry the framework message only.
- CORS/helmet/rate-limit middleware deliberately deferred to Phase 18 (no dashboard origin exists until Phase 5) — tracked, not forgotten.
- `MASTER_ENCRYPTION_KEY` format enforced at boot so Phase 6's token-encryption helper can't start with a broken key.

## 5. Open Questions, Risks & Assumptions

- **Risk:** lazy DB connect (adapter-pg) means boot succeeds with DB down — mitigated by readiness gating (verified 503) and k8s/compose healthchecks wiring to `/health/ready`, not `/health`.
- **OQ-10 (new):** Express 5 ships with Nest 11 — confirmed working here; if any Phase 6+ middleware assumes Express 4 API, flag at review.
- **Assumption:** `withPlatform` misuse is caught by review now, by a lint rule (no `withPlatform` outside `modules/whatsapp` + `common/queue`) in 4b.

## 6. Decision Log Updates

D-027 (zod backend validation), D-028 (ALS single entry), D-029 (UoW as only access pattern), D-030 (generated client in src), D-031 (health split) — appended.

---

## 4b — Domain modules, reference implementation, queue layer (delivered)

### What was built

- **14 module skeletons** under `src/modules/<name>/` per the Phase 2 boundary table. 13 are single-file boundary declarations (ownership + publishes/consumes + build phase in the docblock — extension points, not filler); **Cases** is the full hexagonal reference:
  - `domain/case.ts` — pure TS: status state machine (`LEAD→CONSULTATION→ENGAGED→IN_COURT→CLOSED→ARCHIVED`), domain errors carrying their own HTTP mapping; zero framework/vendor imports (lint-enforced)
  - `application/` — `CasesService` (public surface), zod DTOs, `CaseRepository` port declared against the `DbTx` alias
  - `infrastructure/prisma-case.repository.ts` — Prisma adapter; translates P2002/P2025 into domain errors so the application layer never sees vendor exceptions; JSON columns cross via roundtrip parse (no unchecked casts)
  - `interface/cases.controller.ts` — REST `/v1/cases` with per-handler zod pipes and context-resolved tenant (never from input)
- **Queue layer** (`common/queue`): role-aware BullMQ wiring (producers on both roles, consumers only on worker), **outbox dispatcher** — `FOR UPDATE SKIP LOCKED` batch claim → enqueue with `jobId = event.id` (idempotent re-dispatch) → mark published; 2s scheduler tick; **QueueErrorGuard** (see D-035 lesson)
- **Events** (`common/events`): typed registry with zod-validated T1/T2-only payloads; `OutboxWriter.append()` inside the caller's transaction (state + event atomic, ADR-003)
- **Auth seam** (`common/auth`): `TenantGuard` — production **refuses** (503) until Phase 10 wires Clerk; development resolves `x-tenant-id` header. No insecure default.
- **Boundary lint** (root `eslint.config.mjs`): domain-purity rule + per-module sibling-import bans, generated from the module list
- **Tests**: vitest; case-transition suite incl. domain↔Prisma enum parity, outbox payload discipline suite

### New decisions (4b)

- **D-032 — Layering with a single `DbTx` type alias.** Domain is fully pure; application ports reference one type alias to `Prisma.TransactionClient` (compile-time only). Full generic tx abstraction rejected as ceremony. ORM swap blast radius = one file.
- **D-033 — Auth seam with production refusal.** A guard that 503s in production until Phase 10, dev-header in development. Rejected: a "temporary" permissive guard (temporary permissiveness becomes permanent exposure).
- **D-034 — Outbox dispatch: SKIP LOCKED + jobId idempotency + 2s tick.** Rejected: LISTEN/NOTIFY (lost on restart without a persistence side — outbox IS the persistence); per-event immediate publish from the writing transaction (publish-before-commit window).
- **D-035 — Queue error guard + bounded shutdown drain.** Two operational facts discovered by smoke test, now structural: (1) an unlistened BullMQ `error` event kills the process on broker outage — `QueueErrorGuard` attaches listeners on both roles, API degrades instead of dying; (2) graceful shutdown can hang when a dependency is already dead — SIGTERM/SIGINT now have a 10s bounded drain with forced exit.

### Verification evidence (4b, this environment)

- `nest build` clean; `vitest run` — 6/6 pass
- ESLint clean; **probe file** in `cases/domain` importing `@nestjs/common` + sibling module → exactly 2 boundary errors (rules fire), probe deleted
- Boot api role: all 14 modules initialize, 5 Cases routes mapped; **Redis down → process survives** (guarded error), health 200
- Endpoints: missing tenant header → 401; invalid body → 400 with full zod `issues` array; invalid transition enum → 400 listing valid options; valid request with DB down → clean 500, no internals, correlation id echoed
- SIGTERM with Redis down → port released within drain window (no wedge)
- **Not verified here (no Docker/Postgres/Redis):** live DB transactions, RLS row filtering, outbox→queue flow end-to-end. These are the first CI integration gates (Phase 17); dev machines use `docker compose up`.

### Folder structure (4b)

```
apps/api/src/
├── main.ts / app.module.ts
├── config/env.ts
├── common/
│   ├── auth/          # TenantGuard (Phase-10 seam) + @TenantId
│   ├── context/       # ALS request context
│   ├── correlation/   # middleware
│   ├── errors/        # DomainError base + global filter
│   ├── events/        # registry + OutboxWriter (+ spec)
│   ├── health/        # liveness/readiness
│   ├── persistence/   # DbTx alias
│   ├── pipes/         # ZodValidationPipe
│   ├── prisma/        # service + UnitOfWork + module
│   └── queue/         # constants, QueueModule.register(role), OutboxDispatcher,
│                      # OutboxScheduler, QueueErrorGuard
└── modules/
    ├── cases/         # domain · application · infrastructure · interface (reference)
    └── auth, users, lawyers, messages, whatsapp, ai, rag, documents,
        appointments, payments, notifications, analytics, audit   # shells
```
