# Wakeel — Page Specifications

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Deep Screen Specifications, Query Hooks, and Mutation Pipelines  
**Audit Date:** 2026-10-07  

---

## 1. Overview Page (`apps/web/src/app/(dashboard)/dashboard/page.tsx`)

### 1.1 Purpose & Role Adaptation
Command center providing high-level operational situational awareness:
- Senior Partner: Focuses on revenue, funnel conversion, and SLA breaches.
- Associate Lawyer: Focuses on assigned consultations and today's court hearings.
- Court Clerk: Focuses on unfulfilled document requests and pending payment screenshots.

### 1.2 Data Dependencies & Query Hooks
- `['analytics', 'dashboard']` → `GET /v1/analytics/dashboard` (`dashboardMetricsSchema`)
- `['analytics', 'daily', 7]` → `GET /v1/analytics/daily?days=7` (`dailySeriesSchema`)
- `['analytics', 'funnel']` → `GET /v1/analytics/funnel` (`funnelSchema`)
- `['analytics', 'revenue-by-area']` → `GET /v1/analytics/revenue-by-practice-area` (`revenueByAreaSchema`)
- `['analytics', 'sla-breaches']` → `GET /v1/analytics/sla-breaches` (`slaBreachesSchema`)
- `['inbox', 'recent']` → `GET /v1/inbox` (polled every 5,000ms)

### 1.3 Key Interactions
- Toggle AI Auto-Reply master switch (`PUT /v1/firm-profile/ai-auto-reply`).
- Quick links from SLA banner directly into the offending escalation thread.

---

## 2. Priority Inbox (`apps/web/src/app/(dashboard)/dashboard/inbox/page.tsx`)

### 2.1 Purpose & View Model
Full-bleed WhatsApp Web operational hub:
- Dual-pane layout on desktop; single-pane slide view on mobile.
- Real-time polling of message threads every 5,000ms.

### 2.2 Data Dependencies & Query Hooks
- `['inbox', 'list']` → `GET /v1/inbox` (`inboxListSchema`)
- `['inbox', 'detail', selectedId]` → `GET /v1/inbox/:id` (`inboxDetailSchema`)
- `['users', 'lawyers']` → `GET /v1/users` (for conversation reassignment dropdown)

### 2.3 Mutations & Actions
- `sendMessage`: `POST /v1/inbox/:id/messages` (enforces 24h window).
- `updateState`: `POST /v1/inbox/:id/state` (`AI_ACTIVE`, `HUMAN_REQUIRED`, `HUMAN_ACTIVE`, `CLOSED`).
- `assignLawyer`: `POST /v1/inbox/:id/assign` (reassigns advocate).
- `approveDraft`: `POST /v1/inbox/:id/approve-draft` (approves pending AI response).
- `addNote`: `POST /v1/inbox/:id/notes` (creates internal advocate collaboration note).

---

## 3. Escalations Queue (`apps/web/src/app/(dashboard)/dashboard/escalations/page.tsx`)

### 3.1 Purpose & Triage Workflow
Dedicated queue for safety-triggered matters (domestic violence, arrest, self-harm, urgent deadlines):
- Real-time polling every 5,000ms.
- Displays structured `HandoffBriefView` summarizing client facts and recommended legal next actions.

### 3.2 Data Dependencies & Query Hooks
- `['escalations', tab]` → `GET /v1/escalations?status=:tab` (`escalationListSchema`)

### 3.3 Mutations
- `acknowledge`: `POST /v1/escalations/:id/acknowledge` (marks escalation acknowledged by advocate).
- `resolve`: `POST /v1/escalations/:id/resolve` (marks escalation resolved).

---

## 4. Legal Matters Page (`apps/web/src/app/(dashboard)/dashboard/cases/page.tsx`)

### 4.1 Purpose
Legal case management ledger tracking case references, practice areas, statuses, and urgency ratings.

### 4.2 Data Dependencies & Mutations
- Query: `['cases', statusFilter]` → `GET /v1/cases?status=:filter` (`caseListSchema`)
- Mutation: `transition`: `POST /v1/cases/:id/status` (updates status from `LEAD` to `ENGAGED`, `IN_COURT`, etc.).

---

## 5. Consultation Calendar (`apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`)

### 5.1 Purpose
Interactive monthly calendar combining client consultation appointments with Google Calendar synchronization:
- Monday-first 6-week grid view.
- Appointment booking modal with client and lawyer selectors.

### 5.2 Data Dependencies & Mutations
- Query: `['appointments', { from, to }]` → `GET /v1/appointments?from=...&to=...` (`appointmentListSchema`)
- Query: `['calendar', 'connection']` → `GET /v1/lawyers/me/calendar`
- Mutation: `bookAppointment`: `POST /v1/appointments` (`bookFormSchema`)
- Mutation: `updateStatus`: `POST /v1/appointments/:id/status` (`CONFIRMED`, `CANCELLED`, `COMPLETED`).
