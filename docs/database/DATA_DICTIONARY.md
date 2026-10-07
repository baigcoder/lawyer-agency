# Database Data Dictionary — Complete Table & Column Specification

This document provides a forensic, column-level specification of all 43 database tables (9 platform-schema and 34 app-schema models) defined in `apps/api/prisma/schema.prisma` and extended by native PostgreSQL migrations in `apps/api/prisma/migrations/`.

---

## 1. Platform Schema Tables (`platform.*`)

Cross-tenant operational infrastructure. RLS is not applied on these tables (except `tenants` self-read).

### 1.1 `platform.tenants`
Master registry of law firm organizations subscribed to Wakeel.
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Unique identifier of the law firm.
- **`name`** (`text`, NOT NULL): Registered name of the law practice (e.g., "Malik & Associates Advocates").
- **`slug`** (`text`, UNIQUE, NOT NULL): URL-safe slug for routing and subdomain discovery.
- **`clerkOrgId`** (`text`, UNIQUE, NULLABLE): Mapping to Clerk Organization ID (`org_...`) for multi-tenant auth ([D-017](file:///f:/lawyer_agency/docs/decision-log.md)).
- **`status`** (`enum:TenantStatus`, default: `TRIAL`): `TRIAL`, `ACTIVE`, `SUSPENDED`, `OFFBOARDED`.
- **`settings`** (`jsonb`, default: `{}`): Firm practice areas, office hours (PKT UTC+5), consultation fees, Roman Urdu enablement, default intake language.
- **`aiProviderAllowlist`** (`text[]`, default: `[]`): Restrictive provider list (`groq`, `openai`, `anthropic`). Empty = platform default ([D-005](file:///f:/lawyer_agency/docs/decision-log.md)).
- **`aiMonthlyBudgetMicros`** (`int4`, NULLABLE): Hard monthly spend cap in USD micros ($1.00 = 1,000,000 micros).
- **`retentionDaysOverride`** (`int4`, NULLABLE): Custom data retention policy in days (defaults to 180 days).
- **`createdAt`** / **`updatedAt`** (`timestamptz(6)`): Audit timestamps.

### 1.2 `platform.platform_users`
Super-administrators and platform operations personnel.
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Identifier.
- **`clerkUserId`** (`text`, UNIQUE, NOT NULL): Clerk User identifier.
- **`email`** (`text`, NOT NULL): Staff email.
- **`name`** (`text`, NOT NULL): Full name.
- **`createdAt`** (`timestamptz(6)`): Creation timestamp.

### 1.3 `platform.permissions`
Catalog of fine-grained RBAC permissions available across the application.
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Identifier.
- **`code`** (`text`, UNIQUE, NOT NULL): Capability code (e.g., `case:read`, `case:write`, `payment:record`, `ai:override`, `lawyer:manage`).
- **`description`** (`text`, NOT NULL): Human-readable permission explanation.

### 1.4 `platform.prompt_versions`
Versioned repository of system prompts powering AI triage, intake, and extraction agents ([FR-AI-10](file:///f:/lawyer_agency/docs/phases/phase-01-requirements.md)).
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Prompt identifier.
- **`agent`** (`text`, NOT NULL): Agent name (`intake`, `classification`, `faq`, `summarizer`, `voice_receptionist`).
- **`version`** (`int4`, NOT NULL): Monotonically increasing version number.
- **`template`** (`text`, NOT NULL): Prompt template body containing variable slots (`{{intake_fields}}`, `{{firm_name}}`).
- **`templateHash`** (`text`, NOT NULL): SHA-256 digest of prompt body for audit verification.
- **`isActive`** (`bool`, default: `false`): Current active prompt version flag.
- **`createdAt`** (`timestamptz(6)`): Registry date.
- **Constraints:** `UNIQUE (agent, version)`.

### 1.5 `platform.webhook_events`
Inbound webhook idempotency inbox ([D-004](file:///f:/lawyer_agency/docs/decision-log.md)).
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Primary key.
- **`tenantId`** (`uuid`, FK -> `platform.tenants.id`, NULLABLE): Resolved tenant after header/payload inspection.
- **`provider`** (`text`, default: `'meta'`): Webhook source (`meta`, `evolution`, `jazzcash`, `easypaisa`).
- **`externalEventId`** (`text`, UNIQUE, NOT NULL): Upstream unique ID (`entry[0].changes[0].value.messages[0].id` or Evolution message ID).
- **`phoneNumberId`** (`text`, NULLABLE): Upstream phone identifier.
- **`payload`** (`jsonb`, NULLABLE): Raw payload (scrubbed to NULL post-processing per privacy rules).
- **`status`** (`enum:WebhookEventStatus`, default: `RECEIVED`): `RECEIVED`, `PROCESSED`, `FAILED`, `DUPLICATE`, `IGNORED`.
- **`error`** (`text`, NULLABLE): Processing error stack trace if failed.
- **`receivedAt`** / **`processedAt`** (`timestamptz(6)`): Ingestion and completion timestamps.

### 1.6 `platform.outbox_events`
Transactional outbox ensuring atomic business state mutations and asynchronous dispatch ([D-003](file:///f:/lawyer_agency/docs/decision-log.md)).
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Outbox event UUID.
- **`tenantId`** (`uuid`, FK -> `platform.tenants.id`, NOT NULL): Emitting tenant.
- **`type`** (`text`, NOT NULL): Event identifier (e.g., `case.created`, `escalation.opened`, `payment.confirmed`).
- **`payload`** (`jsonb`, NOT NULL): Event payload strictly limited to T1/T2 identifiers and status codes (zero T3 PII or case documents).
- **`occurredAt`** (`timestamptz(6)`, default: `now()`): Timestamp when transaction committed.
- **`publishedAt`** (`timestamptz(6)`, NULLABLE): Timestamp when polled and pushed to BullMQ.
- **`attempts`** (`int4`, default: `0`): Worker delivery retry counter.
- **Indexes:** `CREATE INDEX outbox_events_publishedAt_occurredAt_idx ON platform.outbox_events (publishedAt, occurredAt)`.

### 1.7 `platform.wa_routes`
Pre-RLS routing table mapping incoming WhatsApp Phone Number IDs to tenant organizations ([D-040](file:///f:/lawyer_agency/docs/decision-log.md)).
- **`phoneNumberId`** (`text`, PK): Meta WhatsApp Phone Number ID or Evolution Instance ID.
- **`tenantId`** (`uuid`, FK -> `platform.tenants.id`, NOT NULL): Target tenant firm.
- **`wabaId`** (`text`, NOT NULL): WhatsApp Business Account ID.
- **`createdAt`** (`timestamptz(6)`): Registration timestamp.

### 1.8 `platform.tenant_features`
Platform-level entitlements gating paid capabilities.
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Feature record ID.
- **`tenantId`** (`uuid`, FK -> `platform.tenants.id`, NOT NULL): Target tenant.
- **`code`** (`enum:TenantFeatureCode`, NOT NULL): Entitlement flag (`OFFICIAL_WHATSAPP`).
- **`status`** (`enum:TenantFeatureStatus`, default: `INACTIVE`): `ACTIVE`, `INACTIVE`, `EXPIRED`.
- **`expiresAt`** (`timestamptz(6)`, NULLABLE): Expiration deadline.
- **`metadata`** (`jsonb`, default: `{}`): Feature configuration properties.
- **Constraints:** `UNIQUE (tenantId, code)`.

### 1.9 `platform.analytics_daily`
Daily aggregated operational metrics computed per tenant firm.
- **`id`** (`uuid`, PK, default: `gen_random_uuid()`): Primary key.
- **`tenantId`** (`uuid`, FK -> `platform.tenants.id`, NOT NULL): Firm ID.
- **`date`** (`date`, NOT NULL): Aggregation day (UTC).
- **`newConversations`** (`int4`, default: `0`): Inbound WhatsApp conversation count.
- **`aiHandled`** (`int4`, default: `0`): Conversations fully resolved by AI.
- **`humanHandled`** (`int4`, default: `0`): Conversations requiring human lawyer intervention.
- **`escalations`** (`int4`, default: `0`): Emergency and SLA escalation triggers.
- **`casesOpened`** / **`casesClosed`** (`int4`, default: `0`): Legal matters opened and concluded.
- **`paymentsCents`** (`int4`, default: `0`): Retainer and consultation fees collected (in PKR paisas).
- **`avgFirstResponseSec`** (`int4`, NULLABLE): Average speed to first response in seconds.
- **Constraints:** `UNIQUE (tenantId, date)`.

---

## 2. App Schema Tables (`app.*`)

Tenant-owned business domain tables. `FORCE ROW LEVEL SECURITY` is enabled on every table.

### 2.1 Identity & RBAC

#### `app.roles`
Custom and system-defined user roles within the law firm.
- `id` (`uuid`, PK): Role identifier.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Tenant isolation key.
- `name` (`text`): Role title (`Firm Admin`, `Advocate`, `Associate`, `Legal Assistant`, `Billing Clerk`).
- `isSystem` (`bool`, default: `false`): System roles cannot be renamed or deleted.
- `createdAt` (`timestamptz(6)`): Created timestamp.
- **Constraints:** `UNIQUE (tenantId, name)`.

#### `app.role_permissions`
Join table binding specific capabilities to tenant roles.
- `id` (`uuid`, PK): Primary key.
- `tenantId` (`uuid`): Tenant ID.
- `roleId` (`uuid`, FK -> `app.roles.id`, ON DELETE CASCADE): Role ID.
- `permissionId` (`uuid`, FK -> `platform.permissions.id`): Permission code ID.
- **Constraints:** `UNIQUE (roleId, permissionId)`.

#### `app.users`
Law firm personnel (advocates, partners, paralegals, administrative staff).
- `id` (`uuid`, PK): User identifier.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Tenant isolation key.
- `clerkUserId` (`text`, UNIQUE, NOT NULL): Clerk Authentication User ID (`user_...`).
- `roleId` (`uuid`, FK -> `app.roles.id`): Assigned role.
- `name` (`text`): Full professional name (e.g., "Advocate Tariq Rahim").
- `email` (`text`): Professional email.
- `phone` (`text`, NULLABLE): Contact phone number.
- `notificationPrefs` (`jsonb`, default: `{}`): Channel flags (`DASHBOARD`, `WEB_PUSH`, `WHATSAPP_TEMPLATE`, `EMAIL_DIGEST`).
- `status` (`enum:UserStatus`, default: `INVITED`): `INVITED`, `ACTIVE`, `SUSPENDED`.
- **Constraints:** `UNIQUE (tenantId, email)`.

#### `app.lawyers`
Professional advocate roster profiles adhering to Pakistan Bar Council standards.
- `id` (`uuid`, PK): Lawyer identifier.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Firm ID.
- `userId` (`uuid`, UNIQUE, FK -> `app.users.id`): User account reference.
- `practiceAreas` (`text[]`, default: `[]`): Areas of law (`Civil`, `Criminal`, `Family & Khula`, `Corporate`, `Constitutional`, `Property/Revenue`).
- `whatsappNumber` (`text`, NULLABLE): Direct WhatsApp number for internal emergency alerts.
- `bio` (`text`, NULLABLE): English professional summary.
- `bioUr` (`text`, NULLABLE): Urdu professional summary (Nastaliq script).
- `yearsExperience` (`int4`, NULLABLE): Years of active practice.
- `barCouncil` (`text`, NULLABLE): Issuing Bar Council (e.g., `Punjab Bar Council`, `Sindh Bar Council`, `Islamabad Bar Council`).
- `barEnrollmentNumber` (`text`, NULLABLE): Official Bar license number (e.g., `PBC-19842-ADV`).
- `education` (`text[]`): Academic qualifications (`LL.B (Punjab)`, `LL.M (London)`).
- `achievements` (`text[]`): Notable reported cases and honors.
- `languages` (`text[]`): Spoken languages (`English`, `Urdu`, `Punjabi`, `Pashto`, `Sindhi`).
- `profileCompletedAt` (`timestamptz(6)`, NULLABLE): Profile completion timestamp.

#### `app.lawyer_availability`
Weekly working hours and consultation appointment slots.
- `id` (`uuid`, PK): Identifier.
- `tenantId` (`uuid`): Firm ID.
- `lawyerId` (`uuid`, FK -> `app.lawyers.id`, ON DELETE CASCADE): Advocate ID.
- `weekday` (`int4`): Day of week (`0` = Sunday, `1` = Monday, ..., `6` = Saturday).
- `startTime` / `endTime` (`text`): Time strings in firm local timezone (e.g., `"09:00"`, `"17:00"`).
- `slotDurationMinutes` (`int4`, default: `30`): Consultation slot size.
- **Constraints:** `UNIQUE (lawyerId, weekday, startTime)`.

#### `app.lawyer_calendars`
Google Calendar two-way synchronization credentials.
- `id` (`uuid`, PK): Identifier.
- `tenantId` (`uuid`): Firm ID.
- `lawyerId` (`uuid`, UNIQUE, FK -> `app.lawyers.id`, ON DELETE CASCADE): Advocate ID.
- `googleRefreshTokenEnc` (`text`): AES-256-GCM encrypted OAuth2 refresh token.
- `googleCalendarId` (`text`, default: `'primary'`): External Google Calendar ID.
- `connectedAt` / `updatedAt` (`timestamptz(6)`): Sync tracking timestamps.

#### `app.lawyer_case_highlights`
Public case victories and portfolio summaries displayed during client AI consultation.
- `id` (`uuid`, PK): Record ID.
- `tenantId` (`uuid`): Firm ID.
- `lawyerId` (`uuid`, FK -> `app.lawyers.id`, ON DELETE CASCADE): Advocate.
- `caseId` (`uuid`, FK -> `app.cases.id`, ON DELETE CASCADE): Underlying case reference.
- `publicTitle` (`text`): Sanitized title (e.g., "Successful Defence in NAB Accountability Matter").
- `publicOutcome` (`text`): Summary outcome with client PII omitted.
- `consentRecordedAt` (`timestamptz(6)`): Date client consented to anonymized portfolio use.
- `visibleToAi` (`bool`, default: `true`): Permitted for AI FAQ retrieval.
- **Constraints:** `UNIQUE (lawyerId, caseId)`.

---

### 2.2 CRM & Client Intake

#### `app.clients`
Client registry identified by verified WhatsApp MSISDN.
- `id` (`uuid`, PK): Client UUID.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Firm ID.
- `waPhone` (`text`, NOT NULL): WhatsApp phone in E.164 format (e.g., `+923001234567`).
- `name` (`text`, NULLABLE): Client full name.
- `cnic` (`text`, NULLABLE): Pakistani Computerised National Identity Card number (`XXXXX-XXXXXXX-X`) ([D-110](file:///f:/lawyer_agency/docs/decision-log.md)).
- `preferredLanguage` (`enum:Language`, default: `UNKNOWN`): `EN`, `UR`, `ROMAN_UR`, `MIXED`, `UNKNOWN`.
- `notes` (`text`, NULLABLE): Advocate internal CRM notes.
- **Constraints:** `UNIQUE (tenantId, waPhone)`.

#### `app.cases`
Legal matters and active case files managed by the firm.
- `id` (`uuid`, PK): Case UUID.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Firm ID.
- `clientId` (`uuid`, FK -> `app.clients.id`): Client reference.
- `reference` (`text`, NOT NULL): Human-readable matter code (e.g., `FAM-2026-0142`, `CIV-LHR-891`).
- `matterType` (`text`, NOT NULL): Practice category (`Family`, `Property`, `Criminal`, `Corporate`).
- `status` (`enum:CaseStatus`, default: `LEAD`): `LEAD`, `CONSULTATION`, `ENGAGED`, `IN_COURT`, `CLOSED`, `ARCHIVED`.
- `urgency` (`enum:Urgency`, default: `NORMAL`): `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.
- `summary` (`text`, NULLABLE): AI-generated matter brief.
- `intakeData` (`jsonb`, default: `{}`): Canonical structured facts extracted during WhatsApp triage ([D-004](file:///f:/lawyer_agency/docs/decision-log.md)).
- `openedAt` / `closedAt` (`timestamptz(6)`): File lifecycle dates.
- **Constraints:** `UNIQUE (tenantId, reference)`.

#### `app.case_lawyers`
Assignment join table connecting advocates to cases.
- `id` (`uuid`, PK): Record ID.
- `tenantId` (`uuid`): Firm ID.
- `caseId` (`uuid`, FK -> `app.cases.id`, ON DELETE CASCADE): Case reference.
- `lawyerId` (`uuid`, FK -> `app.lawyers.id`): Assigned advocate.
- `role` (`text`, default: `'primary'`): Assignment role (`primary`, `assisting`, `counsel`).
- `assignedAt` (`timestamptz(6)`): Assignment date.
- **Constraints:** `UNIQUE (caseId, lawyerId, role)`.

#### `app.conversations`
WhatsApp communication threads between the firm and a client.
- `id` (`uuid`, PK): Thread UUID.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Firm ID.
- `clientId` (`uuid`, FK -> `app.clients.id`): Client participant.
- `caseId` (`uuid`, FK -> `app.cases.id`, NULLABLE): Associated case file.
- `assignedToId` (`uuid`, FK -> `app.users.id`, NULLABLE): Lawyer or staff assigned to manage thread.
- `state` (`enum:ConversationState`, default: `AI_ACTIVE`): `AI_ACTIVE`, `HUMAN_REQUIRED`, `HUMAN_ACTIVE`, `CLOSED`.
- `language` (`enum:Language`, default: `UNKNOWN`): Detected language preference.
- `sessionWindowExpiresAt` (`timestamptz(6)`, NULLABLE): Meta 24-hour customer care session expiry timestamp ([D-003](file:///f:/lawyer_agency/docs/decision-log.md)).
- `disclosedAt` (`timestamptz(6)`, NULLABLE): Timestamp AI disclaimer was sent to client ([FR-AI-01](file:///f:/lawyer_agency/docs/phases/phase-01-requirements.md)).
- `lastClientMessageAt` / `lastOutboundAt` (`timestamptz(6)`): Activity tracking timestamps.

#### `app.intake_sessions`
Structured triage state machine collecting legal facts.
- `id` (`uuid`, PK): Session ID.
- `tenantId` (`uuid`): Firm ID.
- `conversationId` (`uuid`, FK -> `app.conversations.id`): Conversation thread.
- `status` (`enum:IntakeStatus`, default: `IN_PROGRESS`): `IN_PROGRESS`, `COMPLETED`, `ABANDONED`.
- `currentStep` (`text`, default: `'start'`): State machine node (`matter_identification`, `fact_collection`, `court_status`, `document_solicitation`).
- `extractedFields` (`jsonb`, default: `{}`): Fact payload extracted by AI.
- `completedAt` (`timestamptz(6)`, NULLABLE): Completion timestamp.
- **Constraints:** `UNIQUE (tenantId, conversationId)`.

#### `app.escalations`
Urgent incident triggers escalating conversations to human advocates ([FR-AI-07](file:///f:/lawyer_agency/docs/phases/phase-01-requirements.md)).
- `id` (`uuid`, PK): Escalation UUID.
- `tenantId` (`uuid`): Firm ID.
- `conversationId` (`uuid`, FK -> `app.conversations.id`): Thread reference.
- `triggerType` (`enum:EscalationTrigger`): `SELF_HARM`, `DOMESTIC_VIOLENCE`, `ACTIVE_ARREST`, `IMMINENT_DEADLINE`, `MANUAL`.
- `status` (`enum:EscalationStatus`, default: `OPEN`): `OPEN`, `ACKNOWLEDGED`, `RESOLVED`.
- `detectedExcerpt` (`text`, NULLABLE): Minimal verbatim excerpt evidencing trigger (T2 tier).
- `handoffReason` (`text`, NULLABLE): Explanation for advocate.
- `handoffBrief` (`jsonb`, default: `{}`): Structured summary packet ([D-123](file:///f:/lawyer_agency/docs/decision-log.md)).
- `slaDeadline` (`timestamptz(6)`, NOT NULL): SLA acknowledgement limit (15 minutes from detection).
- `acknowledgedBy` (`uuid`, FK -> `app.lawyers.id`, NULLABLE): Advocate who claimed escalation.
- `acknowledgedAt` / `resolvedAt` (`timestamptz(6)`, NULLABLE): Action timestamps.

#### `app.conversation_notes`
Internal advocate notes on conversations invisible to clients.
- `id` (`uuid`, PK): Note UUID.
- `tenantId` (`uuid`): Firm ID.
- `conversationId` (`uuid`, FK -> `app.conversations.id`, ON DELETE CASCADE): Thread reference.
- `authorId` (`uuid`, FK -> `app.users.id`): Note author.
- `body` (`text`): Note text.
- `createdAt` (`timestamptz(6)`): Creation timestamp.

---

### 2.3 Communications & Voice

#### `app.messages` (RANGE-Partitioned by `createdAt`)
Inbound and outbound chat messages ([0003_partitions_and_vector](file:///f:/lawyer_agency/apps/api/prisma/migrations/0003_partitions_and_vector/migration.sql)).
- `id` (`uuid`, NOT NULL, default: `gen_random_uuid()`): Message UUID.
- `tenantId` (`uuid`, NOT NULL): Firm ID.
- `conversationId` (`uuid`, NOT NULL, FK -> `app.conversations.id`): Thread reference.
- `direction` (`enum:MessageDirection`): `INBOUND`, `OUTBOUND`.
- `senderType` (`enum:SenderType`): `CLIENT`, `AI`, `LAWYER`, `STAFF`, `SYSTEM`.
- `senderUserId` (`uuid`, FK -> `app.users.id`, NULLABLE): Staff user who sent message.
- `wamid` (`text`, NULLABLE): Meta WhatsApp message identifier (`wamid.HB...`).
- `contentType` (`enum:ContentType`, default: `TEXT`): `TEXT`, `IMAGE`, `AUDIO`, `VIDEO`, `DOCUMENT`, `LOCATION`, `INTERACTIVE`, `TEMPLATE`, `STICKER`, `CALL`, `OTHER`.
- `body` (`text`, NULLABLE): Raw text content.
- `languageDetected` (`enum:Language`, default: `UNKNOWN`): Detected language.
- `payload` (`jsonb`, default: `{}`): Structured media metadata, location coordinates, interactive buttons.
- `templateName` (`text`, NULLABLE): Approved Meta template name if outbound outside 24h window.
- `deliveryStatus` (`enum:DeliveryStatus`, default: `QUEUED`): `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`.
- `citations` (`jsonb`, default: `[]`): RAG chunks cited by AI response (`[{kbId, chunkId, title}]`).
- `correlationId` (`uuid`, NULLABLE): Trace identifier.
- `createdAt` (`timestamptz(6)`, NOT NULL, default: `now()`): Message creation timestamp.
- **Constraints:** `PRIMARY KEY (id, createdAt)`.

#### `app.voice_calls`
Live WhatsApp audio calls handled by AI Receptionist or missed by firm ([D-124](file:///f:/lawyer_agency/docs/decision-log.md)).
- `id` (`uuid`, PK): Call UUID.
- `tenantId` (`uuid`): Firm ID.
- `conversationId` (`uuid`, FK -> `app.conversations.id`): Associated chat thread.
- `providerCallId` (`text`, NOT NULL): Upstream WebRTC or Wavoip call ID.
- `fromWaPhone` (`text`, NOT NULL): Caller WhatsApp MSISDN.
- `instanceName` (`text`, NOT NULL): Handling Evolution or Meta instance.
- `status` (`enum:VoiceCallStatus`, default: `RINGING`): `RINGING`, `ANSWERED`, `REJECTED`, `COMPLETED`, `FAILED`.
- `disposition` (`enum:VoiceCallDisposition`, NULLABLE): `BOOKED`, `ESCALATED`, `INFO`, `ABANDONED`, `REJECTED_OFF`, `BAILEYS_UNSUPPORTED`, `OUTSIDE_HOURS`.
- `summary` (`text`, NULLABLE): AI call summary.
- `transcriptPath` (`text`, NULLABLE): Storage path to call audio transcript.
- `inboxMessageId` / `appointmentId` / `escalationId` (`uuid`, NULLABLE): Downstream created entity links.
- `startedAt` / `answeredAt` / `endedAt` (`timestamptz(6)`): Call telemetry timestamps.
- **Constraints:** `UNIQUE (tenantId, providerCallId)`.

#### `app.whatsapp_accounts`
Meta WhatsApp Business API official account configurations.
- `id` (`uuid`, PK): Account ID.
- `tenantId` (`uuid`, UNIQUE): One WABA per firm.
- `wabaId` (`text`): Meta WABA ID.
- `phoneNumberId` (`text`, UNIQUE): Meta Phone Number ID.
- `displayPhoneNumber` (`text`): Verified display number (e.g., `+92 42 35789000`).
- `verificationStatus` (`enum:WaVerificationStatus`, default: `NOT_STARTED`): `NOT_STARTED`, `PENDING`, `VERIFIED`, `REJECTED`.
- `connectionStage` (`enum:ConnectionStage`, default: `OFFICIAL_CONNECT_STARTED`): State machine tracking onboarding ([D-092](file:///f:/lawyer_agency/docs/decision-log.md)).
- `qualityRating` (`text`, NULLABLE): Meta quality tier (`GREEN`, `YELLOW`, `RED`).
- `messagingTier` (`text`, NULLABLE): Tier limits (`TIER_1K`, `TIER_10K`, `TIER_100K`).
- `accessTokenEnc` (`text`, NULLABLE): AES-256-GCM encrypted Meta System User token.

#### `app.pilot_sessions`
Evolution API Baileys QR-code pairing sessions for pilot firms ([D-092](file:///f:/lawyer_agency/docs/decision-log.md)).
- `id` (`uuid`, PK): Session ID.
- `tenantId` (`uuid`, UNIQUE): Firm ID.
- `status` (`enum:PilotSessionStatus`, default: `PAIRING`): `PAIRING`, `PAIRED`, `EXPIRED`, `DISCONNECTED`.
- `allowlist` (`jsonb`, default: `[]`): Allowed test numbers in E.164.
- `sessionCredsEnc` (`text`, NULLABLE): AES-256-GCM encrypted Baileys auth tokens.
- `expiresAt` (`timestamptz(6)`): Pairing QR expiration.
- `lastSeenAt` / `lastError` / `lastErrorAt`: Connection health metrics.

#### `app.whatsapp_templates`
Approved WhatsApp message templates for proactive notifications ([D-003](file:///f:/lawyer_agency/docs/decision-log.md)).
- `id` (`uuid`, PK): Template ID.
- `tenantId` (`uuid`): Firm ID.
- `name` (`text`): Template identifier (e.g., `appointment_confirmation_v1`, `hearing_reminder_ur`).
- `language` (`text`): Language code (`en`, `ur`).
- `category` (`enum:TemplateCategory`): `UTILITY`, `AUTHENTICATION`, `SERVICE`. (Note: `MARKETING` is omitted per Bar Council rules).
- `status` (`enum:TemplateStatus`, default: `DRAFT`): `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PAUSED`.
- `components` (`jsonb`): Template structure (Header, Body with params, Buttons).
- `metaTemplateId` (`text`, NULLABLE): Meta template UUID.
- `rejectionReason` (`text`, NULLABLE): Reason if rejected by Meta.
- **Constraints:** `UNIQUE (tenantId, name, language)`.

#### `app.whatsapp_connections`
Active connection state to Evolution API instances.
- `id` (`uuid`, PK): Connection ID.
- `tenantId` (`uuid`, UNIQUE): Firm ID.
- `instanceName` (`text`, UNIQUE): Evolution instance slug.
- `connectionType` (`text`, default: `'baileys'`): Connection driver (`baileys` or `cloud_api`).
- `status` (`text`, default: `'disconnected'`): State (`open`, `connecting`, `close`, `disconnected`).
- `phoneNumber` / `displayName` (`text`, NULLABLE): Connected device info.

---

### 2.4 Document Management & Knowledge

#### `app.documents`
Client-submitted case documents, FIRs, notices, and payment receipts.
- `id` (`uuid`, PK): Document UUID.
- `tenantId` (`uuid`, FK -> `platform.tenants.id`): Firm ID.
- `caseId` (`uuid`, FK -> `app.cases.id`, NULLABLE): Linked case file.
- `clientId` (`uuid`, FK -> `app.clients.id`): Uploading client.
- `messageId` (`uuid`, NULLABLE): Originating WhatsApp message.
- `storagePath` (`text`): Supabase Storage or filesystem path (`tenants/<tenantId>/cases/<caseId>/...`).
- `filename` (`text`): Original filename.
- `description` (`text`, NULLABLE): Document description.
- `mimeType` (`text`): File MIME (`application/pdf`, `image/jpeg`).
- `sizeBytes` (`int4`): File size in bytes.
- `docType` (`enum:DocType`, default: `OTHER`): `CNIC`, `FIR`, `COURT_NOTICE`, `AFFIDAVIT`, `CONTRACT`, `EVIDENCE_PHOTO`, `PAYMENT_PROOF`, `RECEIPT`, `OTHER`.
- `ocrStatus` (`enum:OcrStatus`, default: `PENDING`): `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `SKIPPED`.
- `ocrConfidence` (`float8`, NULLABLE): OCR quality confidence (0.0 to 1.0).
- `extractedText` (`text`, NULLABLE): Full plain text extracted by OCR.
- `extractedFields` (`jsonb`, default: `{}`): Structured legal metadata (FIR number, Police Station, Under Sections).
- `scanStatus` (`enum:ScanStatus`, default: `PENDING`): `PENDING`, `CLEAN`, `INFECTED`, `FAILED`.
- `isPinned` (`bool`, default: `false`): Pinned documents prioritized in AI context.
- `version` (`int4`, default: `1`): Document revision.
- `deletedAt` (`timestamptz(6)`, NULLABLE): Soft-deletion timestamp.

#### `app.document_chunks`
Text chunks and 384-dimensional dense vector embeddings of case documents.
- `id` (`uuid`, PK): Chunk UUID.
- `tenantId` (`uuid`): Firm ID.
- `documentId` (`uuid`, FK -> `app.documents.id`, ON DELETE CASCADE): Document reference.
- `chunkIndex` (`int4`): Sequence order.
- `content` (`text`): Chunk text (500 tokens with 50-token overlap).
- `tokenCount` (`int4`): Number of tokens.
- `embedding` (`vector(384)`, NULLABLE): Local `multilingual-e5-small` embedding ([0029_local_embeddings_384](file:///f:/lawyer_agency/apps/api/prisma/migrations/0029_local_embeddings_384/migration.sql)).
- `metadata` (`jsonb`, default: `{}`): Chunk context tags.
- **Indexes:** HNSW index on `embedding` using `vector_cosine_ops` (`m=16, ef_construction=64`).

#### `app.document_requests`
Formal requests sent to clients over WhatsApp for specific legal documents.
- `id` (`uuid`, PK): Request UUID.
- `tenantId` (`uuid`): Firm ID.
- `caseId` / `clientId` (`uuid`): Matter and client links.
- `description` (`text`): Requested item (e.g., "Certified Copy of Nikahnama", "Bank Statement for last 6 months").
- `status` (`enum:DocumentRequestStatus`, default: `PENDING`): `PENDING`, `FULFILLED`, `CANCELLED`.
- `fulfilledDocumentId` (`uuid`, NULLABLE): Resulting uploaded document UUID.
- `fulfilledAt` (`timestamptz(6)`, NULLABLE): Completion date.

#### `app.knowledge_base`
Firm FAQ articles, standard fee tariffs, and procedure guides.
- `id` (`uuid`, PK): Article UUID.
- `tenantId` (`uuid`): Firm ID.
- `title` (`text`): Article heading.
- `content` (`text`): Markdown article body.
- `language` (`enum:Language`, default: `EN`): Article language.
- `category` (`text`, NULLABLE): Category (`Fee Schedule`, `Court Procedures`, `Office Timings`).
- `status` (`enum:KbStatus`, default: `DRAFT`): `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- `sourceDocumentId` (`uuid`, NULLABLE): Source file link.

#### `app.kb_chunks`
Vector chunks for knowledge base search.
- `id` (`uuid`, PK): Chunk ID.
- `tenantId` (`uuid`): Firm ID.
- `kbId` (`uuid`, FK -> `app.knowledge_base.id`, ON DELETE CASCADE): Article reference.
- `chunkIndex` (`int4`): Chunk sequence.
- `content` (`text`): Chunk content.
- `tokenCount` (`int4`): Token count.
- `embedding` (`vector(384)`, NULLABLE): 384-dim dense vector.
- **Indexes:** HNSW index on `embedding` using `vector_cosine_ops` (`m=16, ef_construction=64`).

---

### 2.5 Practice Operations & Billing

#### `app.appointments`
Consultation appointments booked by clients or lawyers.
- `id` (`uuid`, PK): Appointment UUID.
- `tenantId` (`uuid`): Firm ID.
- `caseId` (`uuid`, NULLABLE): Associated case file.
- `clientId` (`uuid`, FK -> `app.clients.id`): Client attendee.
- `lawyerId` (`uuid`, FK -> `app.lawyers.id`): Advocate attendee.
- `startsAt` / `endsAt` (`timestamptz(6)`): Appointment start and end time.
- `status` (`enum:AppointmentStatus`, default: `PENDING`): `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.
- `location` (`text`, NULLABLE): In-office chamber address or virtual meeting URL.
- `notes` (`text`, NULLABLE): Booking agenda.
- `reminderSentAt` / `confirmationSentAt` (`timestamptz(6)`, NULLABLE): WhatsApp notification tracking.
- `externalEventId` / `externalCalendarId` (`text`, NULLABLE): Google Calendar sync references.
- **Constraints:** PostgreSQL GIST exclusion constraint preventing double-booking:
  ```sql
  EXCLUDE USING gist ("lawyerId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'))
  ```

#### `app.court_hearings`
Pakistani court diary entries tracking hearing dates and proceedings.
- `id` (`uuid`, PK): Hearing UUID.
- `tenantId` (`uuid`): Firm ID.
- `caseId` (`uuid`, FK -> `app.cases.id`, ON DELETE CASCADE): Matter reference.
- `courtName` (`text`, NOT NULL): Court name (e.g., "Lahore High Court", "Sessions Court Rawalpindi", "Family Court Islamabad").
- `judge` (`text`, NULLABLE): Presiding Judge or Bench (e.g., "Justice Aamir Farooq").
- `hearingAt` (`timestamptz(6)`, NOT NULL): Scheduled date and time of hearing.
- `location` (`text`, NULLABLE): Court room or bench number (e.g., "Courtroom No. 3").
- `notes` (`text`, NULLABLE): Stage of proceeding (`Arguments`, `Evidence`, `Cross Examination`, `Framing of Issues`).
- `reminderSentAt` (`timestamptz(6)`, NULLABLE): Automated client WhatsApp reminder timestamp.

#### `app.payments`
Client fee payments, retainers, and consultation receipts.
- `id` (`uuid`, PK): Payment UUID.
- `tenantId` (`uuid`): Firm ID.
- `caseId` / `clientId` (`uuid`): Associated matter and client.
- `amountCents` (`int4`, NOT NULL): Amount in Pakistani paisas (PKR 10,000 = `1000000` paisas).
- `currency` (`char(3)`, default: `'PKR'`): Currency code.
- `method` (`enum:PaymentMethod`): `JAZZCASH`, `EASYPAISA`, `CARD_LOCAL`, `CARD_INTL`, `BANK_TRANSFER`, `CASH`, `OTHER_MANUAL`.
- `status` (`enum:PaymentStatus`, default: `REQUESTED`): `REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `RECORDED_MANUAL`, `CANCELLED`.
- `providerTxnId` (`text`, NULLABLE): Gateway transaction reference (idempotency key).
- `description` (`text`, NULLABLE): Payment purpose (`Initial Legal Consultation`, `Court Filing Fee`).
- `requestedAt` / `paidAt` (`timestamptz(6)`): Timeline.
- `recordedBy` (`uuid`, FK -> `app.users.id`, NULLABLE): Staff member attributing manual receipt.
- `metadata` (`jsonb`, default: `{}`): Gateway payload.
- **Constraints:** Partial unique index: `CREATE UNIQUE INDEX payments_provider_txn_uniq ON app.payments ("tenantId", "providerTxnId") WHERE "providerTxnId" IS NOT NULL`.

#### `app.firm_payment_details`
Encrypted bank account and mobile wallet details for receiving client fees ([D-024](file:///f:/lawyer_agency/docs/decision-log.md), [D-110](file:///f:/lawyer_agency/docs/decision-log.md)).
- `id` (`uuid`, PK): Record ID.
- `tenantId` (`uuid`, UNIQUE): Firm ID.
- `detailsEnc` (`text`, NOT NULL): AES-256-GCM encrypted JSON containing IBAN, Account Title, JazzCash / Easypaisa till numbers.
- `updatedAt` (`timestamptz(6)`): Last update timestamp.

---

### 2.6 Notifications & Observability

#### `app.notifications`
In-app and push notification feed for firm staff.
- `id` (`uuid`, PK): Notification UUID.
- `tenantId` (`uuid`): Firm ID.
- `userId` (`uuid`, FK -> `app.users.id`, ON DELETE CASCADE): Recipient staff.
- `type` (`text`): Event type (`escalation.opened`, `appointment.booked`, `document.uploaded`).
- `payload` (`jsonb`, default: `{}`): Notification summary.
- `channel` (`enum:NotificationChannel`, default: `DASHBOARD`): `DASHBOARD`, `WEB_PUSH`, `WHATSAPP_TEMPLATE`, `EMAIL_DIGEST`.
- `readAt` (`timestamptz(6)`, NULLABLE): Staff read timestamp.
- **Indexes:** Partial index: `CREATE INDEX notifications_unread_idx ON app.notifications ("tenantId", "userId") WHERE "readAt" IS NULL`.

#### `app.push_subscriptions`
Web Push API subscription endpoints for browser alerts.
- `id` (`uuid`, PK): Subscription UUID.
- `tenantId` / `userId` (`uuid`): Tenant and user links.
- `endpoint` (`text`): Browser push service URL.
- `p256dh` / `auth` (`text`): ECDH cryptographic keys.
- **Constraints:** `UNIQUE (userId, endpoint)`.

#### `app.audit_logs` (RANGE-Partitioned by `createdAt`, Append-Only)
Tamper-proof compliance log recording every sensitive data access ([FR-AUD-01](file:///f:/lawyer_agency/docs/phases/phase-01-requirements.md)).
- `id` (`uuid`, NOT NULL, default: `gen_random_uuid()`): Audit ID.
- `tenantId` (`uuid`, NOT NULL): Firm ID.
- `actorType` (`enum:ActorType`): `USER`, `SYSTEM`, `PLATFORM_ADMIN`, `AI`.
- `actorId` (`uuid`, NULLABLE): Performing user or service ID.
- `action` (`text`, NOT NULL): Security action (`case.read`, `document.download`, `payment.refund`, `escalation.override`).
- `entityType` / `entityId` (`text` / `uuid`, NULLABLE): Target resource.
- `metadata` (`jsonb`, default: `{}`): Context details.
- `ip` (`inet`, NULLABLE): Client IP address.
- `userAgent` (`text`, NULLABLE): Browser client string.
- `correlationId` (`uuid`, NULLABLE): Request trace ID.
- `createdAt` (`timestamptz(6)`, NOT NULL, default: `now()`): Creation timestamp.
- **Security:** `REVOKE UPDATE, DELETE ON app.audit_logs FROM app_user`.
- **Constraints:** `PRIMARY KEY (id, createdAt)`.

#### `app.ai_logs` (RANGE-Partitioned by `createdAt`)
Telemetry log of every LLM inference call with token and cost attribution ([FR-AI-10](file:///f:/lawyer_agency/docs/phases/phase-01-requirements.md)).
- `id` (`uuid`, NOT NULL, default: `gen_random_uuid()`): AI Log UUID.
- `tenantId` (`uuid`, NOT NULL): Firm ID.
- `agent` (`text`, NOT NULL): Executing agent (`router`, `intake`, `classification`, `faq`, `voice_receptionist`).
- `provider` (`text`, NOT NULL): Model vendor (`groq`, `openai`, `anthropic`).
- `model` (`text`, NOT NULL): Model name (`llama-3.3-70b-versatile`, `gpt-4o-mini`).
- `promptVersionId` (`uuid`, FK -> `platform.prompt_versions.id`, NULLABLE): Versioned prompt ID.
- `correlationId` (`uuid`, NULLABLE): Request trace UUID.
- `latencyMs` (`int4`, NULLABLE): Model generation latency in milliseconds.
- `queuedMs` (`int4`, NULLABLE): Time spent waiting in BullMQ or retry queues.
- `tokensIn` / `tokensOut` (`int4`, default: `0`): Token counts.
- `costMicros` (`int4`, default: `0`): Financial cost in USD micros.
- `dataTier` (`enum:DataTier`): Tier of data sent (`T1`, `T2`, `T3`).
- `redactionApplied` (`bool`, default: `false`): PII scrubbing flag.
- `status` (`enum:AiCallStatus`): `SUCCESS`, `ERROR`, `FALLBACK_SUCCESS`, `CIRCUIT_OPEN`.
- `error` (`text`, NULLABLE): Error diagnostic if failed.
- `createdAt` (`timestamptz(6)`, NOT NULL, default: `now()`): Log timestamp.
- **Constraints:** `PRIMARY KEY (id, createdAt)`.

#### `app.prompt_logs`
Sanitized input/output prompt evaluations (T2-redacted only, zero T3 PII).
- `id` (`uuid`, PK): Evaluation log UUID.
- `tenantId` (`uuid`): Firm ID.
- `promptVersionId` (`uuid`, FK -> `platform.prompt_versions.id`): Prompt pinned.
- `inputRedacted` / `outputRedacted` (`text`): Anonymized prompt text.
- `evalScore` (`float8`, NULLABLE): Quality score (0.0 to 1.0).
- `correlationId` (`uuid`, NULLABLE): Trace UUID.
- `createdAt` (`timestamptz(6)`): Timestamp.
