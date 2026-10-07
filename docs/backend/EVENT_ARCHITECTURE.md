# Wakeel — Event-Driven Architecture & Domain Events

**Status:** IMPLEMENTED BASELINE & EVENT SPECIFICATION  
**Classification:** Asynchronous Event System, Domain Event Catalog, and Consumer Handlers  
**Source Code References:** `apps/api/src/common/events/domain-events.ts`, `apps/api/src/app.module.ts`  

---

## 1. Event Topology & Delivery Guarantee

State changes in Wakeel produce strongly-typed domain events committed atomically via the **Transactional Outbox**:

```text
Domain Operation (e.g. Book Consultation)
       │
       ▼ (Inside Same DbTx)
1. Write app.appointments record
2. OutboxWriter.append(tx, tenantId, 'appointment.booked', payload)
       │
       ▼ (Postgres COMMIT)
OutboxScheduler ──► Claims PENDING events (SKIP LOCKED)
       │
       ▼
BullMQ Queue: "domain-events"
       │
       ▼ (Worker Role Consumer)
DomainEventsDispatcher ──► Fan out to DOMAIN_EVENT_HANDLERS
                            ├── NotificationDispatcher
                            ├── AnalyticsProjector
                            ├── GoogleCalendarService
                            └── PaymentFeeMessageHandler
```

---

## 2. Domain Event Catalog & Payloads (`domain-events.ts`)

Pay attention to the privacy rule: **Event payloads carry T1/T2 identifiers and statuses only—never raw message bodies, client document bytes, or transcripts.**

| Event Type | Key Payload Fields (Zod Validated) | Triggering Action | Consumers & Side Effects |
|---|---|---|---|
| `case.created` | `caseId`, `matterType`, `urgency`, `reference` | Advocate creates matter or auto-case triggered. | Emits in-app notification, updates daily analytics. |
| `case.status_changed`| `caseId`, `fromStatus`, `toStatus` | Advocate changes case state. | Logs audit trail, updates case funnel metrics. |
| `ai.intake.completed`| `conversationId`, `clientId`, `matterType`, `qualified` | Intake agent satisfies all qualification criteria. | `CaseAutoCreateHandler` opens new case if qualified. |
| `ai.escalation.triggered`| `escalationId`, `conversationId`, `triggerReason` | Safety keyword or tight deadline detected. | `NotificationDispatcher` sends high-priority dashboard alert, web push, audio chime. |
| `appointment.booked`| `appointmentId`, `clientId`, `lawyerId`, `startsAt`, `endsAt` | Client confirms slot on WhatsApp or lawyer books in UI. | `GoogleCalendarService` syncs event, sends WhatsApp text confirmation. |
| `payment.requested`| `paymentId`, `clientId`, `amountPkr`, `method` | Fee prompt issued to client. | `PaymentFeeMessageHandler` sends bank details. |
| `payment.succeeded`| `paymentId`, `amountPkr`, `receiptPdfUrl` | Managing partner verifies screenshot. | `PaymentReceiptHandler` sends PDF receipt + appointment confirmation PDF. |

---

## 3. Registered Domain Event Handlers (`AppModule`)

Configured via the multi-provider `DOMAIN_EVENT_HANDLERS` in `apps/api/src/app.module.ts`:
- `AiEventHandler`: Handles inbound messages and triggers orchestrator pipeline.
- `CaseAutoCreateHandler`: Auto-creates cases on qualified intake (D-112).
- `NotificationDispatcher`: Delivers in-app alerts and web push notifications (Phase 9).
- `AnalyticsProjector`: Projects events into `platform.analytics_daily` CQRS tables (Phase 14).
- `PaymentFeeMessageHandler` & `PaymentReceiptHandler`: Dispatches WhatsApp fee instructions and generates PDF receipts (D-119, D-120).
- `WhatsappUpgradeEventHandler`: Activates official WhatsApp Business features on successful payment (D-101).
