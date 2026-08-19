# Phase 9 — Notifications & Alerting

**Status:** delivered & verified 2026-08-12  
**Scope:** in-app dashboard notifications for domain events, escalation SLA breach monitor, shared domain-event dispatcher, notification dashboard API.

---

## 1. Goal & Definition of Done

**Goal:** turn domain events into actionable in-app alerts and proactively notify firm users when an escalation SLA is breached.

**Done when (all verified, evidence §6):**
- [x] Single `domain-events` BullMQ consumer dispatches to multiple typed handlers
- [x] AI pipeline handler moved from a module-specific processor to the shared dispatcher
- [x] Notification handler creates dashboard rows for `case.created`, `ai.escalation.triggered`, `ai.intake.completed`
- [x] Recipients are all active users of the tenant (preference/role routing later)
- [x] Escalation SLA monitor runs every 60s on the worker role, finds breached open escalations, creates notifications
- [x] Dashboard API: list notifications, unread count, mark read
- [x] New `notifications` queue for scheduled alerting jobs
- [x] Full `tsc --noEmit` clean, 55/55 tests, ESLint clean

## 2. Key Decisions

### D-065 — Single shared domain-events dispatcher
Only one BullMQ processor can consume a queue per process. A central `DomainEventsDispatcher` routes by BullMQ job name to all registered `DomainEventHandler`s. Modules export their handlers; `AppModule` assembles the `DOMAIN_EVENT_HANDLERS` array.

### D-066 — In-app notifications first; push channels later
Phase 9 creates `Notification` rows with `channel = DASHBOARD`. Web push, WhatsApp templates, and email digests land in Phases 12/16.

### D-067 — Escalation SLA monitor as scheduled worker job
`EscalationSlaMonitor` is a BullMQ processor on a dedicated `notifications` queue with a repeating scheduler (every 60s). It queries open escalations whose `slaDeadline` has passed and creates `escalation.sla_breached` notifications.

### D-068 — Notify all active users by default
Until Phase 12 preference/role routing, every active tenant user receives relevant notifications. This guarantees no critical alert is lost due to missing preference data.

### D-069 — Domain-event payloads carry business identifiers only
Handlers receive the full job (`tenantId`, `type`, `payload`) so they can resolve recipients inside the tenant context without leaking T3 data.

## 3. What was built

```
common/events/
├── domain-event-handler.port.ts        # DomainEventHandler interface + token
└── domain-events.ts                    # +kb.indexed (Phase 8) + existing events
common/queue/
├── domain-events-dispatcher.processor.ts # single consumer router
├── queue.constants.ts                  # +NOTIFICATIONS queue
├── queue-error-guard.service.ts        # watches notifications queue too
└── queue.module.ts                     # registers dispatcher + notifications queue on worker
modules/notifications/
├── application/
│   ├── notifications.service.ts        # create/list/mark-read + recipient helpers
│   └── notification-event.handler.ts   # handlers for case/escalation/intake events
├── infrastructure/
│   └── escalation-sla-monitor.service.ts # scheduled breach scanner
├── interface/
│   └── notifications.controller.ts     # /v1/notifications dashboard API
└── notifications.module.ts             # dynamic role-aware registration
modules/ai/
├── application/ai-event.handler.ts     # moved inbound-message handling here
└── ai.module.ts                        # exports AiEventHandler, no longer owns processor
app.module.ts                           # assembles DOMAIN_EVENT_HANDLERS from AI + Notifications
```

## 4. Security & Data Posture

- Notification payloads contain only identifiers and statuses (T1/T2), consistent with outbox discipline.
- The dispatcher passes `tenantId` to handlers; queries are tenant-scoped.
- SLA monitor runs on the worker role only and uses platform-level query (escalations table) plus tenant-scoped user lookup.

## 5. Boundary Observations

- AI module no longer owns a BullMQ processor; it exports a handler consumed by the shared dispatcher. This is the correct pattern for a single-queue topology.
- Notifications module depends only on the exported `AiEventHandler` type as part of AppModule wiring, not on AI internals.

## 6. Verification Evidence (this environment)

- `tsc --noEmit` clean · **55/55 tests** · ESLint clean
- `npm run build` clean
- Unit tests cover: domain-events dispatcher routing, notification service CRUD, notification handler factory, escalation SLA monitor query + notification creation
- **Not verified here (no Docker/Redis):** end-to-end outbox → dispatcher → handler flow, scheduled SLA monitor repetition. First integration run: `docker compose up -d && prisma migrate deploy`.

## 7. Next Work

**Phase 10** — Authentication & authorization (Clerk JWT guard, tenant claim resolution, permission enforcement) OR **Phase 12** — notification channels expansion (web push, WhatsApp templates, digest emails).
