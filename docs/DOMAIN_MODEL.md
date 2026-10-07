# Wakeel — Domain Model

**Status:** IMPLEMENTED BASELINE & SCHEMA SPECIFICATION  
**Classification:** Complete Database Entity & Domain Architecture  
**Source Code Reference:** `apps/api/prisma/schema.prisma` (1,387 lines, 42 models, 2 schemas)  

---

## 1. Schema Partitioning Architecture (D-001, D-019)

The database is divided into two distinct PostgreSQL schemas:
1. **`platform` Schema (Cross-Tenant Infrastructure):** Houses tenant registration, platform credentials, webhook event buffers, outbox queues, permission catalogs, and system prompt registries. **No RLS is applied here.** Access is restricted to platform services and infrastructure jobs.
2. **`app` Schema (Tenant-Owned Operational Data):** Every table carries a `tenantId UUID` foreign key referencing `platform.tenants(id)`. **`FORCE ROW LEVEL SECURITY`** is engine-enforced on every table (`migration 0002`). Access is strictly bounded by the transaction-scoped session variable `app.tenant_id`.

---

## 2. Platform Schema Entities (Infrastructure)

### 2.1 `platform.Tenant`
- **Fields:** `id` (UUID), `clerkOrgId` (String, unique), `name`, `displayName`, `slug` (unique), `status` (`TenantStatus`: TRIAL, ACTIVE, SUSPENDED, OFFBOARDED), `planCode`, `settings` (JSONB), `contactEmail`, `contactPhone`, `createdAt`, `updatedAt`.
- **Purpose:** Root record for every law firm workspace. Maps 1-to-1 with a Clerk organization.

### 2.2 `platform.PlatformUser` & `platform.Permission`
- **Fields:** Super-admin operator identities and the universal system permission catalog (`code`, `name`, `category`, `description`).

### 2.3 `platform.PromptVersion`
- **Fields:** `id`, `agentCode` (ROUTER, INTAKE, FAQ, CASE_UPDATE, HANDOFF_BRIEF), `version`, `language`, `systemPrompt`, `template`, `isActive`.
- **Purpose:** Centralized, auditable AI prompt registry rendered at runtime with firm profile variables.

### 2.4 `platform.WebhookEvent`
- **Fields:** `id`, `provider` (WHATSAPP, EVOLUTION, JAZZCASH, EASYPAISA), `externalEventId` (unique), `payload` (JSONB), `status` (PENDING, PROCESSED, FAILED), `errorReason`, `receivedAt`, `processedAt`.
- **Purpose:** Inbound deduplication fence guaranteeing sub-500ms webhook receipt and idempotent processing.

### 2.5 `platform.OutboxEvent`
- **Fields:** `id`, `tenantId`, `type` (`DomainEventType`), `payload` (JSONB), `status` (PENDING, PUBLISHED, FAILED), `retryCount`, `createdAt`, `publishedAt`.
- **Purpose:** Transactional outbox guaranteeing atomic database state changes and asynchronous BullMQ event publishing.

### 2.6 `platform.WaRoute` & `platform.TenantFeature`
- **WaRoute:** Pre-tenant phone routing table mapping `phoneNumberId` to `tenantId` before entering tenant UoW context.
- **TenantFeature:** Feature flag entitlement matrix (`OFFICIAL_WHATSAPP`, etc.).

---

## 3. App Schema Entities (Tenant Operations — RLS Enforced)

### 3.1 Identity & Practice Organization
- **`app.Role` & `app.RolePermission`:** Tenant-customizable roles and assigned permission codes.
- **`app.User`:** Legal staff, associates, and partners (`clerkUserId`, `email`, `fullName`, `phone`, `status`, `notificationPrefs`).
- **`app.Lawyer`:** Professional advocate profile (`barRegistrationNumber`, `designation`, `bio`, `specialties`, `hourlyRateMinorUnits`, `officeHours`).
- **`app.LawyerAvailability`:** Day-of-week consultation schedule (`weekday`, `startTime`, `endTime`, `slotDurationMinutes`).
- **`app.LawyerCalendar`:** Encrypted Google OAuth refresh token and calendar sync tracking.
- **`app.LawyerCaseHighlight`:** Key landmark cases and court wins injected into AI intro prompts for credibility.

### 3.2 Clients & Casework
- **`app.Client`:** Client CRM profile (`primaryPhone`, `fullName`, `city`, `preferredLanguage`, `cnicNumber`, `firstSeenAt`).
- **`app.Case`:** Legal matter file (`reference`, `matterType`, `status`, `urgency`, `courtType`, `caseSummary`, `assignedLawyerId`).
- **`app.CaseLawyer`:** Many-to-many advocate assignment on active cases.
- **`app.CourtHearing`:** Court diary record (`hearingAt`, `courtName`, `courtRoom`, `judgeName`, `purpose`, `outcomeSummary`).

### 3.3 Communications & WhatsApp Threads
- **`app.Conversation`:** WhatsApp thread (`waContactNumber`, `state`: AI_ACTIVE, HUMAN_REQUIRED, HUMAN_ACTIVE, CLOSED; `sessionWindowExpiresAt`, `assignedToId`).
- **`app.Message`:** Partitioned message log (`id`, `direction`: INBOUND/OUTBOUND; `senderType`: CLIENT/AI/LAWYER/STAFF/SYSTEM; `body`, `contentType`, `mediaUrl`, `status`: QUEUED/SENT/DELIVERED/READ/FAILED; `citations`, `createdAt`).
- **`app.ConversationNote`:** Internal advocate-only case collaboration notes.
- **`app.VoiceCall`:** Live call session record (`callId`, `channel`: WEBRTC/SIP; `status`, `durationSeconds`, `transcriptText`, `callerNumber`).

### 3.4 AI, Triage & Knowledge Base
- **`app.IntakeSession`:** Structured data extracted during client intake (`qualificationStatus`, `facts` JSONB, `lastQuestionField`).
- **`app.Escalation`:** Safety triage record (`triggerReason`, `detectedExcerpt`, `status`: OPEN/ACKNOWLEDGED/RESOLVED; `slaExpiresAt`, `handoffBrief` JSONB).
- **`app.KnowledgeBase` & `app.KbChunk`:** Firm verified legal FAQs and 384-dimensional pgvector chunk embeddings (`Unsupported("vector(384)")`).
- **`app.AiLog` & `app.PromptLog`:** Operational audit of all LLM invocations, token costs (USD micros), and prompt renders.

### 3.5 Documents, Calendar & Payments
- **`app.Document` & `app.DocumentChunk`:** Uploaded client court documents, extracted text, and pgvector embeddings for RAG retrieval.
- **`app.DocumentRequest`:** Automated document requests issued to clients over WhatsApp (`documentType`, `status`: PENDING/RECEIVED).
- **`app.Appointment`:** Client consultations (`startsAt`, `endsAt`, `status`: PENDING/CONFIRMED/CANCELLED/COMPLETED/NO_SHOW; `googleEventId`).
- **`app.Payment`:** Fee collection record (`amountMinorUnits`, `currency`: PKR; `method`, `status`, `screenshotProofUrl`, `receiptPdfUrl`).
- **`app.FirmPaymentDetails`:** AES-256-GCM encrypted bank account and JazzCash/Easypaisa details.
- **`app.Notification` & `app.PushSubscription`:** In-app notifications and Web Push VAPID endpoints.
- **`app.WhatsappConnection` & `app.WhatsappTemplate`:** Evolution API instance configuration and Meta-approved template pack records.
