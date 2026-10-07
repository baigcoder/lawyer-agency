# Wakeel — Backend API Contracts

**Status:** IMPLEMENTED BASELINE & API SPECIFICATION  
**Classification:** REST Endpoints, HTTP Methods, Request DTOs, and Response Schemas  
**Base Path:** `/v1` (configured globally in `apps/api/src/main.ts` with `/health` excluded)  

---

## 1. System Health & Platform Edge

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/health` | None | Public | Liveness probe (dependency-free). |
| `GET` | `/health/ready` | None | Public | Readiness probe (verifies Postgres connection pool). |

---

## 2. Authentication & Firm Provisioning

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/auth/me` | None | Auth Required | Resolves caller user record, tenant, and assigned role. |
| `PUT` | `/v1/firm-provisioning` | `FirmProvisioningDto` | Clerk Org Admin | Idempotently creates or updates firm tenant settings. |
| `GET` | `/v1/firm-provisioning/status`| None | Clerk Org Member | Status query driving frontend `ProvisioningGuard`. |

---

## 3. Firm Profile & Settings (`/v1/firm-profile`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/firm-profile` | None | `firm-profile:read` | Returns firm profile settings. |
| `PUT` | `/v1/firm-profile` | `UpdateFirmProfileDto` | `users:manage` | Updates legal name, city, practice areas, office hours. |
| `PUT` | `/v1/firm-profile/ai-auto-reply` | `{ enabled: boolean }`| `users:manage` | Toggles AI auto-reply on/off (D-107). |
| `GET` | `/v1/firm-profile/ai-settings` | None | `users:manage` | Returns AI assumptions, tone, and voice settings. |
| `PUT` | `/v1/firm-profile/ai-settings` | `AiSettingsDto` | `users:manage` | Updates AI prompts, assumptions, and voice IDs. |
| `GET` | `/v1/firm-profile/payment-details`| None | `payments:read` | Returns masked receiving details. |
| `PUT` | `/v1/firm-profile/payment-details`| `FirmPaymentDetailsDto`| `users:manage` | Encrypts and stores bank account and wallet details. |

---

## 4. Priority Inbox & Communications (`/v1/inbox`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/inbox` | Query params | `inbox:read` | Returns active conversations with snippet and unread counts. |
| `GET` | `/v1/inbox/:id` | None | `inbox:read` | Returns complete message thread, client details, notes. |
| `POST` | `/v1/inbox/:id/messages`| `{ body: string }` | `inbox:write` | Dispatches manual reply over WhatsApp (enforces 24h window). |
| `POST` | `/v1/inbox/:id/state` | `{ state: string }` | `inbox:write` | Transitions state (`HUMAN_ACTIVE`, `CLOSED`, etc.). |
| `POST` | `/v1/inbox/:id/assign` | `{ assignedToId }` | `inbox:write` | Reassigns conversation to specific advocate. |
| `POST` | `/v1/inbox/:id/approve-draft`| None | `inbox:write` | Approves and sends pending AI-generated draft reply. |
| `POST` | `/v1/inbox/:id/notes` | `{ content: string }`| `inbox:write` | Appends private advocate internal case note. |
| `GET` | `/v1/inbox/media/:id` | None | `inbox:read` | Streams binary voice note audio or image attachment. |

---

## 5. Escalations & Safety Triage (`/v1/escalations`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/escalations` | `?status=OPEN` | `inbox:read` | Lists safety escalations with handoff briefs. |
| `POST` | `/v1/escalations/:id/acknowledge`| None | `inbox:write` | Marks escalation acknowledged by an advocate. |
| `POST` | `/v1/escalations/:id/resolve`| None | `inbox:write` | Marks escalation resolved. |

---

## 6. Cases & Court Diary (`/v1/cases`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/cases` | `?status=all` | `cases:read` | Returns legal matters list. |
| `POST` | `/v1/cases` | `CreateCaseDto` | `cases:write` | Opens a new legal case. |
| `POST` | `/v1/cases/:id/status` | `{ to: CaseStatus }` | `cases:write` | Transitions case status (`ENGAGED` → `IN_COURT`, etc.). |
| `POST` | `/v1/cases/:id/hearings`| `CreateHearingDto` | `cases:write` | Schedules next court hearing date and courtroom. |

---

## 7. Consultations & Calendar (`/v1/appointments`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/appointments` | `?from=...&to=...` | `appointments:read` | Returns appointments for date window. |
| `POST` | `/v1/appointments` | `BookAppointmentDto` | `appointments:write`| Schedules a client consultation. |
| `POST` | `/v1/appointments/:id/status`| `{ status }` | `appointments:write`| Updates status (`CONFIRMED`, `CANCELLED`). |

---

## 8. Payments & Fee Collection (`/v1/payments`)

| Method | Endpoint | Request Body | Permission Guard | Description |
|---|---|---|---|---|
| `GET` | `/v1/payments` | Query params | `payments:read` | Lists fee records and receipts. |
| `POST` | `/v1/payments/request` | `PaymentFormDto` | `payments:write` | Dispatches fee instructions to client over WhatsApp. |
| `POST` | `/v1/payments/:id/verify`| None | `payments:write` | Verifies screenshot and generates official PDF receipt. |

---

## 9. Webhooks & WhatsApp Edge

| Method | Endpoint | Verification | Description |
|---|---|---|---|
| `POST` | `/v1/webhooks/evolution` | HMAC Secret | Ingests Evolution API WhatsApp messages and connection updates. |
| `POST` | `/v1/webhooks/whatsapp` | Meta HMAC-SHA256 | Ingests official Meta Cloud API webhooks. |
| `GET` | `/v1/webhooks/whatsapp` | Challenge Verify Token | Meta webhook verification handshake. |
