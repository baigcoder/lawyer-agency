# Wakeel — Product Principles

**Status:** IMPLEMENTED BASELINE & ENFORCED POLICY  
**Classification:** Core Architectural and Engineering Rules  
**Cross-References:** `AGENTS.md`, `docs/decision-log.md` (D-001 to D-125)

---

## 1. Tenancy is Engine-Enforced, Never Application-Filtered

### Principle
Tenant isolation is a database guarantee enforced by PostgreSQL Row-Level Security (`FORCE RLS`) and non-owner database user roles. It is not an application-level convention or a developer promise.

### Enforced Rule
- Every table residing in schema `app` must declare a `tenantId UUID` foreign key to `platform.tenants(id)`.
- `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` must be applied to all tenant tables (`migration 0002_rls_and_constraints`).
- The application executes queries under the `app_user` role, which holds `NOBYPASSRLS`.
- Tenancy is activated strictly per transaction via `UnitOfWork.withTenant(tenantId, fn)`:
  ```sql
  SELECT set_config('app.tenant_id', $tenantId, true);
  ```
- Any direct query without a valid tenant context fails closed: `NULLIF(current_setting('app.tenant_id', true), '')::uuid` resolves to `NULL`, returning 0 rows.
- Application-level filters (`where: { tenantId }`) serve as defense-in-depth only.

---

## 2. Ethical AI Boundaries: Assistance, Not Practice of Law

### Principle
Wakeel is a legal assistant for law firms. It does not practice law, give legal advice, predict judicial outcomes, or form attorney-client relationships autonomously.

### Enforced Rule
- **Mandatory First-Message Disclosure:** The very first interaction with any new WhatsApp client must explicitly identify the assistant as an AI/automated intake assistant (`firstDisclosureSent`).
- **KB-Grounded Answers Only:** The FAQ agent (`FaqAgent`) only answers queries directly supported by published, verified knowledge base articles (`KnowledgeBase` with `status: PUBLISHED`) or verified legal process packs (`pakistan-process`). Unsupported queries trigger an automatic transition to `HUMAN_REQUIRED`.
- **Zero Legal Guarantees:** Prompts strictly forbid probabilistic outcome statements (e.g., *"Aapki bail zaroor ho jayegi"* / *"Your bail will definitely be granted"*).
- **Deterministic Hard Escalations:** Critical keywords (domestic violence, suicide/self-harm, active detention/police custody, immediate deadlines ≤48h) immediately halt the AI pipeline via regex matching prior to LLM invocation, notify on-call advocates, and supply standard institutional crisis helplines.

---

## 3. Tiered AI Data Posture (T1 / T2 / T3)

### Principle
Client information is strictly categorized to prevent sensitive court records, personal identity data, and privileged attorney-client materials from reaching third-party LLMs.

### Classification Matrix
| Tier | Definition | Handling & Destination | Allowed Surfaces |
|---|---|---|---|
| **T1 (Identifiers & Metadata)** | UUIDs, phone numbers, timestamps, message direction, payment statuses, delivery ticks. | Permitted in logs, metrics, transactional outbox payloads, and queue jobs. | Outbox, queues, database indexes, webhook payloads. |
| **T2 (Intake Facts & Neutral Summaries)** | Case practice area, client name, general legal topic, city, structured handoff brief facts. | Sanitized and processed through contractually bound, zero-retention LLM endpoints (OpenAI API with zero-retention / self-hosted open models). | In-flight AI orchestrator, LLM inference, structured handoff briefs. |
| **T3 (Sensitive Documents & Privileged Media)** | Raw court petitions, FIR copies, national identity cards (CNIC), bank statements, audio recordings, call transcripts. | **NEVER sent to third-party generative LLMs.** Audio is transcribed via isolated STT (hosted Whisper or local Whisper port); documents are parsed locally/securely (`pdf-parse`, `mammoth`) for local embedding generation only (`multilingual-e5-small`). Raw files remain in tenant-isolated encrypted storage (`SupabaseObjectStorage` or filesystem dev stand-in). | Tenant encrypted storage, advocate dashboard only. |

---

## 4. WhatsApp 24-Hour Session Window Discipline

### Principle
WhatsApp Meta Cloud API mandates that businesses can only send free-form session messages within 24 hours of the client's last message. Outside this window, proactive messages must use pre-approved templates.

### Enforced Rule
- Every inbound message updates `Conversation.sessionWindowExpiresAt = now() + 24 hours`.
- `SendService` calculates window validity prior to dispatching outbound messages.
- If the window is expired:
  - Free-form manual replies from dashboard advocates are blocked with a clear user alert.
  - System proactive notifications must specify an approved template (`WhatsappTemplate` with `status: APPROVED`).
  - Attempting to send free-form messages outside the window throws `WindowClosedError` (Meta error 131047 mapping).
- **Carve-out for Pilot Connections:** Sockets operating over Evolution API Baileys QR connections do not have Meta's 24h constraint; `SendService.pilotRouted` allows text delivery while still recording audit trails.

---

## 5. Mirror-the-Client Language Discipline

### Principle
Clients in Pakistan must be met in their native language and script. System replies must mirror the client's language without patronizing or forcing English.

### Enforced Rule
- **Language Detection:** Inbound messages are classified as `EN` (English), `UR` (Urdu in Arabic script), or `ROMAN_UR` (Urdu in Latin script) via `reply-language.ts` and `fast-route.ts`.
- **Response Mirroring:**
  - Client writes in Urdu script: Wakeel replies in clear, formal Urdu (`.font-urdu`).
  - Client writes in Roman Urdu: Wakeel replies in natural, legible Roman Urdu.
  - Client writes in English: Wakeel replies in professional legal English.
- **Intake Normalization:** Internal structured data (matter type, urgency, court, dates) is extracted into canonical English for the lawyer's dashboard, preserving the raw original transcript alongside.

---

## 6. Human-in-the-Loop & Advocate Sovereignty

### Principle
The firm owner and advocates are the ultimate authority. The automation works for them, not around them.

### Enforced Rule
- **Owner AI Auto-Reply Toggle:** The firm owner can toggle `aiAutoReplyEnabled` off at any time (`/v1/firm-profile/ai-auto-reply`). Inbound messages then enter `HUMAN_REQUIRED` without AI interference.
- **Draft Approval Mode:** When `aiAutoReplyRequiresApproval` is active, AI-generated replies are stored as `QUEUED` messages with `pendingApproval: true`. Advocates inspect, edit, and approve them before transmission.
- **Instant Human Takeover:** An advocate typing a manual message in the dashboard inbox transitions the conversation to `HUMAN_ACTIVE`, silencing automated replies for that thread.

---

## 7. Zero Inbound Data Loss & Idempotent Processing

### Principle
A client reaching out in a legal crisis must never have their message dropped due to server restarts, database timeouts, or race conditions.

### Enforced Rule
- **Sub-500ms Webhook Acknowledgment:** Inbound webhooks (`/v1/webhooks/evolution`, `/v1/webhooks/whatsapp`) verify cryptographic signatures (HMAC-SHA256), write raw events to `platform.webhook_events` with unique constraint idempotency, and immediately return `200 OK`.
- **Async Queue Pipeline:** Parsing, AI orchestration, media downloading, and push notifications are offloaded to BullMQ workers (`role=worker`).
- **Transactional Outbox:** State changes and event emissions are atomic. Domain events are recorded in `platform.outbox_events` in the same database transaction via `OutboxWriter.append`.
