# Wakeel — Backend Architecture

**Status:** IMPLEMENTED BASELINE & ARCHITECTURAL SPECIFICATION  
**Classification:** Server Topology, Process Roles, Layering Rules, and Hexagonal Boundaries  
**Stack Baseline:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16 + pgvector, Redis + BullMQ  
**Source Code References:** `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `docs/decision-log.md` (D-010 to D-035)  

---

## 1. Process Topology & Role Architecture (D-013, D-124)

Wakeel is packaged as a **single container image** that runs in one of three roles determined at boot by the `API_ROLE` environment variable:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SINGLE DOCKER IMAGE                               │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ ROLE = "api"         │ ROLE = "worker"      │ ROLE = "voice"                │
│ (HTTP Server)        │ (BullMQ Consumers)   │ (WhatsApp Receptionist)       │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ • Express HTTP on    │ • No HTTP port       │ • No HTTP port                │
│   port 3001          │ • Attaches BullMQ    │ • Registers SIP Trunk         │
│ • Serves /v1 REST    │   workers            │   at sipv2.wavoip.com         │
│ • Handles webhooks   │ • Outbox dispatcher  │ • Listens for WebRTC /        │
│   (/v1/webhooks/*)   │ • AI orchestrator    │   SIP INVITE calls            │
│ • Emits to outbox    │ • Media downloader   │ • Runs voice agent & tools    │
│   and queues         │ • SLA / Reminders    │ • WebRTC ports 40000–40031    │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

All three roles boot through the same `AppModule` (`apps/api/src/app.module.ts`). This ensures that domain logic, entity mappings, and database schemas never drift between API and worker processes.

---

## 2. Hexagonal Layering & Boundary Rules (D-032, D-043)

Each module in `apps/api/src/modules/` adheres to strict hexagonal layering:

```text
modules/<name>/
├── domain/            # Pure enterprise business logic. NO NestJS, NO Prisma, NO vendor SDKs.
├── application/       # Use cases, application services, ports, and orchestrators.
├── infrastructure/    # Adapters: database queries, external vendor HTTP clients, BullMQ queues.
└── interface/         # HTTP controllers, webhook receivers, CLI commands.
```

### Enforced Lint Boundary Rules (`eslint.config.mjs`)
1. **Domain Purity:** Files inside `modules/*/domain/**` are forbidden from importing `@nestjs/*`, `@prisma/*`, or generated Prisma clients.
2. **Sibling Isolation:** A module may import another module's *exported application service* only (the public port). Direct imports into a sibling's `domain/`, `infrastructure/`, or `interface/` are strictly banned by ESLint rule `no-restricted-imports`.

---

## 3. Database Connection Architecture (Prisma 7 & Adapter-Pg)

- **Query Compiler Adapter:** Uses `@prisma/adapter-pg` with a pooled PostgreSQL driver, eliminating the legacy Rust engine binary (D-026).
- **Client Generation Target:** The Prisma client is generated into `src/generated/prisma` so that TypeScript's root directory remains `src/` and output maps 1:1 into `dist/`.
- **Role URLs:** Migrations run under `MIGRATION_DATABASE_URL` (database owner role with `BYPASSRLS`), while the application runs under `DATABASE_URL` (`app_user` role with `NOBYPASSRLS`).
