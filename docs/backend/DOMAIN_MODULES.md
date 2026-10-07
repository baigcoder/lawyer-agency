# Wakeel — Backend Domain Modules Catalog

**Status:** IMPLEMENTED BASELINE & MODULE INVENTORY  
**Classification:** Complete Catalog of 18 NestJS Domain Modules  
**Location:** `apps/api/src/modules/`  

---

## 1. Domain Modules Roster

| Module Name | Directory | Primary Exported Application Services (Public Ports) | Handled Domain Events & Responsibilities |
|---|---|---|---|
| **`ai`** | `modules/ai/` | `AiOrchestratorService`, `EscalationsService`, `AiEventHandler` | Master router, Greeting/Intake/FAQ agents, regex safety scanner, structured handoff briefs. |
| **`analytics`** | `modules/analytics/` | `AnalyticsService`, `AnalyticsProjector` | CQRS event projection into `platform.analytics_daily`, funnel metrics, SLA breaches. |
| **`appointments`** | `modules/appointments/` | `AppointmentsService`, `SlotFinderService`, `GoogleCalendarService` | Lawyer weekly availability, booking consultations, calendar sync, WhatsApp confirmations. |
| **`audit`** | `modules/audit/` | `AuditService` | Append-only security and operational audit logging in `app.audit_logs`. |
| **`auth`** | `modules/auth/` | `AuthService`, `AuthGuard` | Clerk JWKS verification, dev seam header resolution, lazy user provisioning. |
| **`cases`** | `modules/cases/` | `CasesService`, `HearingsService`, `CaseAutoCreateHandler` | Legal matter lifecycle (`LEAD` → `CLOSED`), court diary hearings, auto-case creation on qualified lead. |
| **`documents`** | `modules/documents/` | `DocumentsService`, `ObjectStoragePort` | Supabase / filesystem storage, PDF/mammoth extraction, RAG chunking, client folders. |
| **`firm-profile`** | `modules/firm-profile/` | `FirmProfileService`, `FirmProvisioningService` | Tenant settings, practice areas, AI auto-reply toggle, encrypted bank receiving details. |
| **`inbox`** | `modules/inbox/` | `InboxService` | WhatsApp conversation read/triage models, conversation notes, manual reply dispatch. |
| **`lawyers`** | `modules/lawyers/` | `LawyersService`, `LawyerMeService` | Advocate credentials, Bar council registration, hourly rates, bio highlights. |
| **`messages`** | `modules/messages/` | `MessagesService` | Monthly-partitioned messages, 24-hour window roll, inbound deduplication. |
| **`notifications`** | `modules/notifications/` | `NotificationDispatcher`, `NotificationsService` | In-app alerts, Web Push VAPID, email digest, escalation SLA monitor BullMQ worker. |
| **`payments`** | `modules/payments/` | `PaymentsService`, `PaymentRailFactory`, `PaymentReceiptHandler` | JazzCash/Easypaisa/bank instruction delivery, screenshot proof tracking, PDF receipts. |
| **`rag`** | `modules/rag/` | `RagService`, `VectorRetriever`, `EmbeddingClient` | pgvector 384-dim HNSW retrieval, chunk embeddings, Pakistan legal process pack. |
| **`users`** | `modules/users/` | `UsersService` | Local users, roles, permissions, Clerk organization invitations. |
| **`voice`** | `modules/voice/` | `VoiceReplyService`, `VoicePreviewService` | WhatsApp audio voice note transcription (Whisper) and speech synthesis (ElevenLabs). |
| **`voice-calls`** | `modules/voice-calls/` | `VoiceReceptionistService`, `WavoipSipUa`, `WebRtcBridge` | Live WhatsApp voice AI receptionist, Cloud Calling WebRTC, Wavoip SIP UA for QR calls. |
| **`whatsapp`** | `modules/whatsapp/` | `SendService`, `EvolutionConnectionService`, `EvolutionWebhookIngestService` | Evolution API transport layer, webhook HMAC verification, template packs. |
