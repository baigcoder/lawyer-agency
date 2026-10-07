# Wakeel — UX Heuristic Audit (Nielsen Norman 10 Heuristics)

**Status:** FORENSIC HEURISTIC EVALUATION  
**Classification:** Usability Inspection against Established UX Principles  
**Evaluator:** Principal Product Designer & Staff Frontend Engineer  
**Audit Date:** 2026-10-07  

---

## 1. Visibility of System Status

| Evaluation Score | Status | Key References |
|---|---|---|
| **9 / 10** | **IMPLEMENTED & HIGH PASS** | `HeaderWhatsappStatus`, `DeliveryTicks`, `SlaBanner` |

- **Findings:**
  - **WhatsApp Connection:** Header displays an active badge with real-time Evolution status (`Connected`, `Connecting`, `Disconnected`) via `HeaderWhatsappStatus`.
  - **Message Delivery:** Messages show authentic WhatsApp delivery ticks: single check (sent), double check (delivered), cyan double check (read), clock (queued).
  - **Escalation Urgency:** Escalated conversations feature an SLA countdown banner displaying time to breach.
- **Recommendations:** Add a subtle audio/visual sync spinner when TanStack Query is actively fetching background updates in the conversation list.

---

## 2. Match Between System and the Real World

| Evaluation Score | Status | Key References |
|---|---|---|
| **9.5 / 10** | **IMPLEMENTED & EXCELLENT** | `apps/web/src/lib/translations.ts`, Pakistani Legal Terminology |

- **Findings:**
  - **Pakistani Legal Concepts:** Uses familiar terminology (*Vakalatnama*, *Fard*, *Challan*, *Cause List*, *Bail*, *Khula*, *Nikahnama*).
  - **WhatsApp Native Conventions:** Priority Inbox mirrors WhatsApp Web's exact bubble structure, audio note scrubber, and day divider chips (`"TODAY"`, `"YESTERDAY"`).
  - **Local Payment Rails:** Prompts and fee inputs lead with JazzCash, Easypaisa, and Pakistani bank account details (IBAN/Account Title), reflecting the cash/transfer reality of Pakistani legal practice.

---

## 3. User Control and Freedom

| Evaluation Score | Status | Key References |
|---|---|---|
| **8.5 / 10** | **IMPLEMENTED & PASS** | `AiControls`, `SessionGate`, Cancel Transitions |

- **Findings:**
  - **Advocate Sovereignty:** Firm owner can disable AI auto-reply globally with one toggle (`aiAutoReplyEnabled`).
  - **Conversation Takeover:** Typing in the inbox switches the conversation to `HUMAN_ACTIVE`, silencing automated bot messages.
  - **Draft Rejection:** AI drafts can be edited or rejected outright by advocates.
- **Recommendations:** Implement an "Undo" toast (5-second grace window) when accidentally marking an escalation resolved or closing a case.

---

## 4. Consistency and Standards

| Evaluation Score | Status | Key References |
|---|---|---|
| **9 / 10** | **IMPLEMENTED & HIGH PASS** | `globals.css`, `@base-ui/react`, Base Primitives |

- **Findings:**
  - **Design Tokens:** Strict use of OKLCH tokens (`--primary`, `--card`, `--border`, `--muted`) across all pages.
  - **Icon Consistency:** Consistent use of `LucideIcon` glyphs with uniform sizing (`size-4` default) and emerald-tinted icon tiles (`IconTile`).
  - **Component Uniformity:** Standardized `PageHeader`, `MetricCard`, `Card`, and `Badge` usage throughout.

---

## 5. Error Prevention

| Evaluation Score | Status | Key References |
|---|---|---|
| **9 / 10** | **IMPLEMENTED & HIGH PASS** | 24h Window Check, Zod Schemas, RHF Resolvers |

- **Findings:**
  - **WhatsApp Window Blocking:** Prevents advocates from sending free-form replies when the 24-hour window has lapsed, preventing Meta API error penalties.
  - **Form Validation:** All inputs (appointments, team invites, fee collection, firm profile) use strict Zod schemas with instant boundary error highlights.
  - **Booking Conflict Prevention:** `SlotFinderService` prevents double-booking across lawyers and checks against gazetted Pakistan public holidays.

---

## 6. Recognition Rather than Recall

| Evaluation Score | Status | Key References |
|---|---|---|
| **9 / 10** | **IMPLEMENTED & HIGH PASS** | `HandoffBriefView`, Client Badges, Practice Area Chips |

- **Findings:**
  - **Lawyer Handoff Brief:** Summarizes client facts, category, and open action items at the top of escalated threads, eliminating the need to re-read prior chat history.
  - **Case Conversion Context:** Converting an inbox conversation pre-populates client name, phone number, and matter type automatically.

---

## 7. Flexibility and Efficiency of Use

| Evaluation Score | Status | Key References |
|---|---|---|
| **8 / 10** | **PARTIALLY IMPLEMENTED** | Navigation, Hotkeys, Filter Badges |

- **Findings:**
  - Quick status chips on Cases (`ALL`, `LEAD`, `CONSULTATION`, `ENGAGED`, etc.) and Escalations allow one-click filtering.
- **Recommendations:** Implement global keyboard shortcuts (`J`/`K` thread navigation, `Cmd+K` global search) to optimize speed for power users.

---

## 8. Aesthetic and Minimalist Design

| Evaluation Score | Status | Key References |
|---|---|---|
| **9.5 / 10** | **IMPLEMENTED & EXCELLENT** | OKLCH Palette, Typography, Base UI |

- **Findings:**
  - Restrained, dignified visual hierarchy. No neon glows, no cartoonish illustrations, no marketing noise.
  - Clean separation between primary legal data and supporting metadata.
  - Beautiful dark mode with deep zinc-950 surfaces and balanced emerald accents.

---

## 9. Help Users Recognize, Diagnose, and Recover from Errors

| Evaluation Score | Status | Key References |
|---|---|---|
| **7.5 / 10** | **PARTIALLY IMPLEMENTED** | `ApiError`, Toast Alerts, Form Feedback |

- **Findings:**
  - Form validation errors appear directly under the offending fields with descriptive messages.
  - Server errors trigger toast notifications displaying error descriptions.
- **Recommendations:**
  - Surface the `x-correlation-id` in error modals so advocates can easily copy it for technical support lookups.
  - Fix `apiRequest` in `api-client.ts:56` to gracefully accept `204 No Content` responses instead of throwing an error.

---

## 10. Help and Documentation

| Evaluation Score | Status | Key References |
|---|---|---|
| **8.5 / 10** | **IMPLEMENTED & PASS** | Launch Checklist, AI Guardrails, Help Badges |

- **Findings:**
  - The Overview page features clear AI Guardrails cards explaining system boundaries.
  - The Setup Hub provides progressive steps with helpful guidance and simulated test messaging.
