# Wakeel — Observability, Logging & Telemetry

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Structured Logging, Correlation Tracing, Metrics, and Error Monitoring  
**Source Code References:** `apps/api/src/common/logger/`, `apps/api/src/common/middleware/correlation.middleware.ts`, `apps/api/src/main.ts`  

---

## 1. Structured Logging with Pino

All backend logs output strictly in structured JSON (in production) or formatted human-readable output (in development via `pino-pretty`):

```json
{
  "level": 30,
  "time": 1775573420123,
  "pid": 1,
  "hostname": "api-6d9b4c7f-8x2z",
  "correlationId": "8f3e5b12-9c44-48f1-a1b2-c0e4d9b3a1a1",
  "tenantId": "e2a1b4c3-5678-4a1b-9c2d-3e4f5a6b7c8d",
  "module": "ai-orchestrator",
  "msg": "Processed inbound message intent: FAQ",
  "durationMs": 412,
  "llmTokens": { "prompt": 142, "completion": 68 }
}
```

---

## 2. Distributed Correlation Tracing

- **Edge Generation:** The browser API client (`apiRequest`) generates an `x-correlation-id: crypto.randomUUID()` on every outbound fetch.
- **AsyncLocalStorage Isolation:** `CorrelationMiddleware` intercepts every incoming request and stores the correlation ID in Node.js `AsyncLocalStorage`.
- **Automatic Propagation:** Every downstream service call, database transaction, and BullMQ job payload inherits this correlation ID automatically without requiring manual parameter passing.
- **Response Header:** The API echoes `x-correlation-id` back in the HTTP response headers.

---

## 3. Error Monitoring & Sentry PII Sanitization

- **Sentry Integration:** Initialized in both NestJS (`apps/api`) and Next.js (`apps/web`) via `SENTRY_DSN`.
- **Zero PII Leakage:** Before an event is dispatched to Sentry, an interceptor redacts:
  - Client telephone numbers (`+92 3xx xxx xxxx`).
  - National Identity Card numbers (CNIC: `xxxxx-xxxxxxx-x`).
  - Client voice note audio URLs and transcripts.
  - Bank account numbers and IBANs.

---

## 4. Health & Orchestrator Probes

- **Liveness Probe (`GET /health`):** Returns HTTP 200 `{ status: 'ok' }`. Zero external dependencies. Used by Docker / Kubernetes to detect deadlocked Node.js event loops.
- **Readiness Probe (`GET /health/ready`):** Verifies active PostgreSQL pool connectivity (`SELECT 1`). Returns HTTP 503 if the database is unreachable, pausing ingress traffic.
