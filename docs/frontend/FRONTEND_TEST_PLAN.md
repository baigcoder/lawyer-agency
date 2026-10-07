# Wakeel — Frontend Test Plan & Quality Assurance Strategy

**Status:** IMPLEMENTED BASELINE & QA SPECIFICATION  
**Classification:** Testing Topologies, Component Suites, E2E Workflows, and Quality Gates  
**Current Test Status:** TypeScript typecheck clean (`tsc --noEmit`), ESLint clean (`0 errors`), E2E plan scoped  

---

## 1. Testing Pyramid & Target Coverage

```text
               ┌───────────────────────┐
               │  E2E Smoke Suite      │  Playwright (Core Workflows)
               │  (Desktop + Mobile)   │
               ├───────────────────────┤
               │  Integration Specs    │  RTL + MSW (Page Workflows)
               ├───────────────────────┤
               │  Component Unit Tests │  Vitest + Testing Library
               └───────────────────────┘
```

---

## 2. Priority E2E Test Scenarios (Playwright)

### Scenario 1: Priority Inbox Live Triage & 24h Window Check
1. Advocate signs in via dev seam (`dev-tenant-pk-01`).
2. Navigates to `/dashboard/inbox`.
3. Verifies split-pane renders conversation list.
4. Selects conversation with open window: Verifies composer is enabled; types reply; submits; verifies message appears in thread.
5. Selects conversation with expired window: Verifies warning badge renders and free-form input is disabled.

### Scenario 2: Safety Escalation & Lawyer Handoff Brief
1. Trigger test inbound with domestic violence keyword.
2. Verify escalation badge updates to `(1)` in real time.
3. Open `/dashboard/escalations`.
4. Inspect `HandoffBriefView`: Verify trigger reason (`DOMESTIC_VIOLENCE`) and extracted client facts.
5. Click "Acknowledge" and verify status transitions to `ACKNOWLEDGED`.

### Scenario 3: Consultation Booking with Conflict Validation
1. Open `/dashboard/calendar`.
2. Click "Book Consultation".
3. Enter `endsAt` earlier than `startsAt`: Verify Zod refinement error displays (`"End time must be after start time"`).
4. Correct time and submit: Verify new appointment block appears on calendar grid.

### Scenario 4: Bilingual Toggle & RTL Alignment
1. Tap Language Toggle from English to Urdu.
2. Assert `document.documentElement.lang === 'ur'`.
3. Assert `document.documentElement.dir === 'rtl'`.
4. Verify navigation bar flips to right edge and `.font-urdu` applies without clipping.

---

## 3. CI/CD Quality Gates
1. `npm run lint` across `apps/web` must return 0 errors.
2. `tsc --noEmit` must compile with 0 type errors.
3. Next.js standalone build (`npm run build`) must succeed.
4. Playwright smoke suite passes against local dev stack.
