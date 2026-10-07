# Wakeel — WhatsApp Transport & Integration Architecture

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Messaging Transport Layer, Evolution API Gateway, and Webhook Pipelines  
**Decision Log Reference:** D-106 (Unified Evolution API Transport)  
**Source Code References:** `apps/api/src/modules/whatsapp/`  

---

## 1. Unified Transport via Evolution API (D-106)

To eliminate the operational complexity of maintaining two separate, fragile in-house WhatsApp stacks (a raw Baileys socket engine and a direct Meta Graph API integration), Wakeel unifies transport under **Evolution API**:

```text
┌────────────────────────────────────────────────────────┐
│                   EVOLUTION API                        │
│          (Self-Hosted Container on Port 8080)          │
├──────────────────────────┬─────────────────────────────┤
│ Baileys QR Instances     │ Official Meta Cloud API     │
│ (Free Pilot Connection)  │ (Paid Upgrade Enterprise)   │
└──────────────────────────┴─────────────────────────────┘
          ▲                               ▲
          │ REST API                      │ Webhook POST
          │ (Send Message)                │ (messages.upsert)
          ▼                               ▼
┌────────────────────────────────────────────────────────┐
│               WAKEEL BACKEND APPLICATION               │
│ • EvolutionApiClient        • EvolutionWebhookIngest   │
│ • EvolutionOutboundSender   • EvolutionConnectionSvc   │
└────────────────────────────────────────────────────────┘
```

- Each law firm workspace maps to an isolated Evolution instance record stored in `app.whatsapp_connections`.
- Wakeel interacts with Evolution strictly via authenticated REST calls and consumes standardized webhook events.

---

## 2. Inbound Webhook Security & Idempotency

### 2.1 Webhook Verification & Timing-Safe Comparison
Inbound payloads sent by Evolution or Meta Cloud API are verified before parsing:
- Compares HMAC-SHA256 signatures using `crypto.timingSafeEqual` to prevent timing attacks.
- Malformed or invalid signatures are acknowledged and dropped immediately without leaking internal system state.

### 2.2 The Three-Fence Inbound Idempotency Pipeline (D-045)
Because cellular carriers and WhatsApp frequently retry webhook dispatches, Wakeel enforces three sequential deduplication barriers:

```text
Incoming Webhook
      │
      ▼
[FENCE 1: Database Dedup] ──► INSERT INTO platform.webhook_events (externalEventId)
                                 │ (Unique Constraint Conflict? Drop silently!)
                                 ▼
[FENCE 2: Queue Dedup]    ──► BullMQ jobId = webhookEvent.id
                                 │ (Job already queued? Redis drops duplicate!)
                                 ▼
[FENCE 3: Application]    ──► MessagesService.recordInbound(wamid)
                                 │ (Already in app.messages? Skip insert!)
                                 ▼
                              AI Orchestrator Pipeline Runs Exactly Once
```

---

## 3. Delivery Status Updates (Monotonic Rank Guarantee, D-050)

Outbound WhatsApp delivery receipts arrive out of order across unreliable mobile networks:
- Delivery statuses are ranked monotonically: `QUEUED` (0) < `SENT` (1) < `DELIVERED` (2) < `READ` (3).
- Status downgrades (e.g. receiving a delayed `SENT` receipt after already receiving a `READ` receipt) are ignored.
- `FAILED` is terminal and cannot be overwritten by subsequent receipts.
