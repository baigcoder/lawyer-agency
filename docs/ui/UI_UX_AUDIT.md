# Wakeel — UI / UX Forensic Audit

**Status:** FORENSIC AUDIT COMPLETE  
**Classification:** Visual, Interaction, and Component Inspection  
**Audit Scope:** Web Application (`apps/web`), Layouts, Components, Navigation, and Theme System  
**Audit Date:** 2026-10-07  

---

## 1. Executive Summary & Audit Baseline

A forensic audit of the existing Next.js 16 (`apps/web`) frontend was conducted across 22 pages, 30 application components, 18 Base UI primitives, and the OKLCH token layer in `globals.css`.

### Headline Audit Findings
1. **Strengths:**
   - **Solid Foundations:** Modern Next.js 16.3 + React 19 + Tailwind v4 architecture with `@base-ui/react` primitives and clean `render` composition.
   - **Bilingual Infrastructure:** Comprehensive translation dictionary (`76KB` in `translations.ts`), `.font-urdu` with Noto Nastaliq Urdu, and automatic `dir="rtl"` synchronizing in `LanguageProvider`.
   - **Authentic WhatsApp Web Design:** Priority Inbox (`apps/web/src/components/inbox/`) faithfully replicates WhatsApp Web tokens (`--wa-*`), delivery ticks, audio waveform voice notes, and bubble spacing.
   - **Zero Flash Theme Engine:** Custom `ThemeScript` and `useSyncExternalStore` provider avoids React 19 client `<script>` warnings.
2. **Opportunities for Polish & Hardening:**
   - **Table Patterns:** Multiple table views (`cases/page.tsx`, `payments/page.tsx`, `analytics/page.tsx`) lack unified sorting, column filtering, and bulk operations.
   - **Empty States:** Several pages show basic text strings when empty rather than illustrated, actionable, lawyer-centric guidance.
   - **Error Recovery:** API errors render simple toast messages or red text without structured retry controls or correlation ID copy actions.
   - **Keyboard Navigation:** Inbox and calendar lack unified global hotkeys (e.g. `J`/`K` navigation, `A` for draft approval).

---

## 2. Page-by-Page Audit Findings

### 2.1 Overview Command Center (`/dashboard`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- **Audit Assessment:** Strong operational density. Includes metric cards, AI controls card, funnel strip, escalation preview, today's schedule, and payment follow-ups.
- **Identified Gap:** The launch checklist cards and guardrails cards are prominent on desktop, which can push today's operational schedule down below the fold on 1080p laptop screens.
- **Recommendation:** Implement collapsible widgets and priority reordering so active daily items (today's hearings and consultations) remain above the fold.

### 2.2 Priority Inbox (`/dashboard/inbox`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/inbox/page.tsx`
- **Audit Assessment:** Excellent WhatsApp Web split-pane implementation (`inboxMode` disables outer dashboard header and padding for full-bleed viewport fitting).
- **Component Stack:** `conversation-list.tsx`, `conversation-detail.tsx`, `voice-note.tsx`, `handoff-brief-view.tsx`.
- **Identified Gap:** The conversation search filter only searches client phone numbers and names in memory; it does not trigger server-side message content search across message history.

### 2.3 Escalations & Safety Triage (`/dashboard/escalations`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/escalations/page.tsx`
- **Audit Assessment:** Tabbed views (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `ALL`) with live polling every 5,000ms. Displays `HandoffBriefView` cleanly.
- **Identified Gap:** Resolving an escalation requires clicking into the item, but there is no inline batch acknowledgment action for multiple open escalations during a crisis.

### 2.4 Cases & Court Diary (`/dashboard/cases`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/cases/page.tsx`
- **Audit Assessment:** Displays matter reference, status badge, urgency, and inline status transition dropdown. Integrates `DocumentRequestsCard`.
- **Identified Gap:** The table lacks cause-list court dates and judge names directly in the primary columns (court hearings are managed in a separate endpoint).
- **Recommendation:** Elevate `CourtHearing` next-date badge directly into the cases table row.

### 2.5 Calendar & Consultations (`/dashboard/calendar`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`
- **Audit Assessment:** 6-week grid view with status badges, month navigation, booking modal, and Google Calendar connection card.
- **Identified Gap:** Grid view does not have an hourly day-view or week-view toggle for busy multi-advocate firms with multiple appointments in a single afternoon.

### 2.6 Documents & Client Folders (`/dashboard/documents`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/documents/page.tsx`
- **Audit Assessment:** Clean dual-mode switcher (`By Client Folder` vs `By Case`). Integrates `DocumentManager` with upload and pinning.
- **Identified Gap:** Document preview requires downloading the file; inline PDF modal preview is not yet implemented.

### 2.7 Fee Collection & Payments (`/dashboard/payments`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/payments/page.tsx`
- **Audit Assessment:** Tabbed views (`REQUESTED`, `PENDING`, `SUCCEEDED`), metric cards, encrypted receiving details configuration card, and receipt generation.
- **Identified Gap:** Screenshot verification dialog displays the uploaded image URL but lacks an inline zoom/rotate tool for reading blurry mobile banking screenshots.

### 2.8 Team & Availability Matrix (`/dashboard/team`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/team/page.tsx`
- **Audit Assessment:** Member roster, Clerk org invite trigger, designation, and 7-day availability editor with start/end time controls.
- **Identified Gap:** Setting identical office hours across all 5 weekdays requires manual entry on each row; lacks a "Copy to all weekdays" shortcut.

### 2.9 Firm Settings (`/dashboard/settings`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
- **Audit Assessment:** Comprehensive multi-section settings (General, Firm, Owner, Payments, AI, Notifications). Integrates `AiSettingsCard` and `OwnerProfileCard`.
- **Identified Gap:** Language policy toggle is clear, but lacks an inline preview of what an AI response will look like under each policy.
