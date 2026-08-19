# Phase 14 — Analytics CQRS Read Models

**Goal:** Build event-projected analytics read models so the dashboard overview shows real metrics without scanning operational tables.

## What was built

### Backend (`apps/api`)

1. **Schema / migration**
   - Added `AnalyticsDaily` model in `platform` schema with daily counters: new conversations, AI/handled, human handled, escalations, cases opened/closed, payments cents.
   - Migration `0009_analytics_daily` created; Prisma client regenerated.

2. **Outbox enhancement**
   - `DomainEventJob` now includes `occurredAt` (from the outbox row) so projectors bucket by event time, not processing time.
   - `OutboxDispatcher` selects and forwards `occurredAt` to BullMQ jobs.

3. **Analytics projector** (`modules/analytics/application/analytics-projector.service.ts`)
   - Idempotent upsert-on-conflict raw SQL for counters.
   - Methods: `recordNewConversation`, `recordAiHandled`, `recordHumanHandled`, `recordEscalation`, `recordCaseOpened`, `recordCaseClosed`, `recordPayment`.

4. **Analytics event handler** (`modules/analytics/application/analytics-event.handler.ts`)
   - Listens to `message.inbound.received`, `ai.escalation.triggered`, `case.created`, `case.status.changed`, `payment.succeeded`.
   - Registered in `AppModule` alongside AI and notification handlers.

5. **Analytics service + controller**
   - `AnalyticsService.dashboard()` sums last-7 and last-30 windows.
   - `GET /v1/analytics/dashboard` returns: new leads 7d, AI containment rate, escalations 7d, cases opened/closed, fees collected 30d.

### Frontend (`apps/web`)

1. **Overview page** (`/dashboard`)
   - Replaced placeholder cards with live metrics from `/v1/analytics/dashboard`.
   - Zod schema in `src/lib/schemas/analytics.ts`.

## Decisions (D-083…D-085)

- **D-083:** Analytics as event-projected read models in `platform.analytics_daily`; dashboard queries projections.
- **D-084:** Domain event job carries `occurredAt` from the outbox row for event-time bucketing.
- **D-085:** Projections updated via upsert-on-conflict raw SQL for idempotent counters.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx vitest run` — **25 test files, 86 tests pass**.
- `npx eslint "src/**/*.ts"` — clean.
- `npm run build` — API and web both build.

## Next

- Phase 15 (deploy/ops): Docker production image, NGINX config, health checks, observability wiring, CI pipeline.
