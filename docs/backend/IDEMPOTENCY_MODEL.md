# Wakeel — Idempotency & Exactly-Once Processing Model

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Distributed Systems Idempotency, Deduplication Fences, and State Integrity  
**Core Technologies:** PostgreSQL Unique Constraints, Redis BullMQ Deterministic Job IDs  

---

## 1. The Distributed Systems Reality

In a multi-tenant WhatsApp SaaS platform operating across third-party cellular networks, telco payment switches, and Google APIs:
- **Networks are lossy:** Packets are resent, webhooks are retried, and mobile browsers trigger double clicks.
- **Delivery is At-Least-Once:** External providers guarantee they will deliver events *at least once*, not *exactly once*.
- **Business Processing Must Be Exactly-Once:** Charging a client twice, booking duplicate appointments, or sending duplicate WhatsApp replies violates firm professionalism.

---

## 2. The Idempotency Layer Matrix

| Ingestion Boundary | Provider / Rail | Idempotency Key / Mechanism | Deduplication Barrier | Fallback / Recovery Action |
|---|---|---|---|---|
| **WhatsApp Inbound** | Evolution / Meta | `externalEventId` (WAMID) | `platform.webhook_events(externalEventId)` unique index | HTTP 200 returned immediately; duplicate dropped. |
| **Outbox Event Dispatch** | Worker Process | `event.id` (UUID) | BullMQ deterministic `jobId: event.id` | Redis drops duplicate job enqueue attempt. |
| **Domain Event Handlers**| Asynchronous Workers | Domain entity primary keys | DB transaction check inside `UnitOfWork.withTenant` | Handler detects entity already processed; no-ops cleanly. |
| **Payment Webhooks** | JazzCash / Easypaisa | `pp_TxnRefNo` / `order_id` | `app.payments(gatewayRef)` unique constraint | Prevents double-crediting or duplicate receipts. |
| **Google Calendar Sync** | Google Calendar API | `appointment.googleEventId` | Checks existing event ID before creating | Updates existing event rather than inserting a duplicate. |

---

## 3. Webhook Inbound Code Pattern (`webhook-events.repository.ts`)

```typescript
try {
  await tx.webhookEvent.create({
    data: {
      provider,
      externalEventId,
      payload,
      status: 'PENDING',
    },
  });
} catch (error) {
  if (isUniqueConstraintViolation(error)) {
    // Duplicate webhook received from provider: acknowledge with 200 but do not process
    this.logger.warn({ externalEventId }, 'Duplicate webhook dropped cleanly');
    return null;
  }
  throw error;
}
```
