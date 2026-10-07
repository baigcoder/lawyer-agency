# Wakeel — Feature Matrix & Implementation Audit

**Status:** FORENSIC REPOSITORY AUDIT  
**Classification:** Complete Feature Inventory & Current Implementation Status  
**Audit Date:** 2026-10-07  

---

## Legend & Status Classifications

| Status Code | Meaning |
|---|---|
| **IMPLEMENTED** | Fully coded, wired into active pipelines, tested, and operational in production/dev. |
| **PARTIALLY IMPLEMENTED** | Working code exists, but certain edge cases, UI controls, or background handlers are incomplete. |
| **PLANNED** | Architecturally scoped in decision logs and phase documents, awaiting scheduled sprint. |
| **MISSING** | Expected standard capability not yet built or wired into the application. |
| **BROKEN** | Code exists but currently fails tests, throws runtime errors, or has broken dependencies. |
| **RISK** | Works today, but carries architectural, operational, or legal liability risks. |
| **RECOMMENDATION** | Architectural or UX improvement identified during forensic review. |

---

## 1. Feature Audit Matrix

| Feature / Capability | Domain Module | Route / File Path | Status | Forensic Notes & Repositories References |
|---|---|---|:---:|---|
| **Postgres RLS Tenancy** | Common / Prisma | `apps/api/src/common/prisma/unit-of-work.ts`, migration `0002` | **IMPLEMENTED** | Engine-enforced `FORCE RLS` on all `app.*` tables. GUC `app.tenant_id` set per transaction. |
| **Clerk JWT Authentication** | Auth | `apps/api/src/modules/auth/`, `apps/web/src/proxy.ts` | **IMPLEMENTED** | Clerk v7 with compact org claims (`o.id`). Dev seam operates cleanly when keys are absent. |
| **Granular Local RBAC** | Users / Auth | `apps/api/src/common/auth/permission.guard.ts`, `D-116` | **IMPLEMENTED** | Permission decorators (`@RequirePermission`), local roles (`Owner`, `Lawyer`, `Staff`). |
| **Transactional Outbox** | Common / Events | `apps/api/src/common/events/outbox-writer.ts` | **IMPLEMENTED** | Atomic `platform.outbox_events` writes inside UoW tx. SKIP LOCKED BullMQ claim processor. |
| **Evolution WhatsApp Transport** | WhatsApp | `apps/api/src/modules/whatsapp/application/evolution-*.ts` | **IMPLEMENTED** | Evolution API REST + webhook integration (D-106). Replaced legacy in-house pilot bridge. |
| **24-Hour WhatsApp Window** | WhatsApp | `apps/api/src/modules/whatsapp/application/send.service.ts` | **IMPLEMENTED** | Tracks `sessionWindowExpiresAt`. Blocks out-of-window free-form sends (`WindowClosedError`). |
| **Bilingual UI (English & Urdu)** | Web Core | `apps/web/src/lib/translations.ts`, `globals.css` | **IMPLEMENTED** | Full dictionary (76KB), `dir="rtl"` support, Noto Nastaliq font (`.font-urdu`), line-height 2.1. |
| **AI Intake Orchestrator** | AI | `apps/api/src/modules/ai/application/ai-orchestrator.service.ts` | **IMPLEMENTED** | Single-question intake flow, multi-turn state preservation, language-mirroring. |
| **Safety Escalation Detector** | AI | `apps/api/src/modules/ai/application/escalation-detector.service.ts` | **IMPLEMENTED** | Dual-fence: regex keyword scan (DV, arrest, self-harm, ≤48h) + LLM fallback. |
| **Lawyer Handoff Brief** | AI / Escalations | `apps/api/src/modules/ai/application/handoff-brief.ts`, `apps/web/src/components/escalations/` | **IMPLEMENTED** | Structured T2 briefs with trigger reason, facts, open items, and next actions. |
| **Live Voice Receptionist** | Voice Calls | `apps/api/src/modules/voice-calls/`, `API_ROLE=voice` | **IMPLEMENTED** | WebRTC for Cloud API, Wavoip SIP UA (G.711 PCMU) for QR calls, VAD, tools integration. |
| **WhatsApp Voice Note STT/TTS** | Voice | `apps/api/src/modules/voice/application/` | **IMPLEMENTED** | Composite Whisper STT + ElevenLabs Turbo v2.5 Urdu voice generation. |
| **Consultation Slot Booking** | Appointments | `apps/api/src/modules/appointments/`, `apps/api/src/modules/ai/application/appointment-booking.ts` | **IMPLEMENTED** | Numbered slot offers (1, 2, 3), lawyer availability checks, Pakistan holiday filtering. |
| **Google Calendar Sync** | Appointments | `apps/api/src/modules/appointments/application/google-calendar.service.ts` | **IMPLEMENTED** | OAuth token encryption, creates/updates/deletes Google events on booking changes. |
| **Pakistan Fee Collection** | Payments | `apps/api/src/modules/payments/` | **IMPLEMENTED** | Encrypted JazzCash/Easypaisa/bank instruction delivery, screenshot receipt tracking. |
| **PDF Receipt Generation** | Payments | `apps/api/src/modules/payments/application/payment-receipt.pdf.ts` | **IMPLEMENTED** | Generates branded PDF receipts with appointment confirmations upon lawyer verification. |
| **Document Storage & RAG** | Documents / RAG | `apps/api/src/modules/documents/`, `apps/api/src/modules/rag/` | **IMPLEMENTED** | Supabase Storage + filesystem fallback, PDF/DOCX parsing, 384-dim vector embeddings. |
| **Court Diary & Hearings** | Cases | `apps/api/src/modules/cases/application/hearings.service.ts` | **IMPLEMENTED** | Hearing scheduling + automated 24h BullMQ reminders (`hearing-reminder`). |
| **AI Auto-Reply Toggle** | Firm Profile | `apps/api/src/modules/firm-profile/`, `/v1/firm-profile/ai-auto-reply` | **IMPLEMENTED** | Firm owner can toggle AI auto-reply on/off; messages enter `HUMAN_REQUIRED` when off. |
| **Human-in-the-Loop Approval** | Inbox | `apps/api/src/modules/inbox/`, `/v1/inbox/:id/approve-draft` | **IMPLEMENTED** | When enabled, AI drafts queue for advocate review before outbound WhatsApp dispatch. |
| **Priority Inbox Dashboard** | Web Dashboard | `apps/web/src/app/(dashboard)/dashboard/inbox/page.tsx` | **IMPLEMENTED** | Full WhatsApp Web UI replica, audio note player, case conversion, internal notes. |
| **Simulated Test Inbound** | WhatsApp / Setup | `/v1/whatsapp/pilot/test-inbound`, `apps/web/src/app/(dashboard)/dashboard/setup/page.tsx` | **IMPLEMENTED** | In-dashboard test message simulator allowing live preview of full AI pipeline. |
| **Web Push Notifications** | Notifications | `apps/api/src/modules/notifications/infrastructure/web-push.channel.ts` | **PARTIALLY IMPLEMENTED** | VAPID push channel exists; needs production VAPID key configuration and worker service worker registration polish. |
| **Electronic Card Payments** | Payments | `apps/api/src/modules/payments/application/rail.factory.ts` | **RISK / GATED** | Gated behind `PAYMENTS_ELECTRONIC_ENABLED=true` (D-096 fail-closed) pending signed PSP agreements. |
| **Vitest Native Binding (Win32)** | Testing | `node_modules/rolldown` | **BROKEN (LOCAL)** | Host npm install missing `@rolldown/binding-win32-x64-msvc` (Linux/Docker installed). Runs in Docker. |
| **ESLint Boundary Violation** | Voice Application | `apps/api/src/modules/voice/application/whatsapp-media.processor.ts:17` | **BROKEN (LINT)** | Directly imports sibling `whatsapp/infrastructure/evolution-api.client`, violating boundary rule. |
| **ApiClient 204 Handling** | Web Core | `apps/web/src/lib/api-client.ts:56` | **RECOMMENDATION** | `apiRequest` throws on 204 status; endpoints returning 204 (e.g. empty DELETE) throw `ApiError`. |
