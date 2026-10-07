# Wakeel — UI Information Architecture & Component Hierarchy

**Status:** IMPLEMENTED BASELINE & ROUTE SPECIFICATION  
**Classification:** Frontend Component Tree, Layout Wrappers, and Screen Breakdown  
**Target:** Next.js 16 App Router (`apps/web/src/app`)  

---

## 1. Root & Dashboard Layout Hierarchy

```text
RootLayout (apps/web/src/app/layout.tsx)
 ├── ThemeScript (server anti-flash)
 ├── LanguageScript (server anti-flash)
 ├── SkipToContent Link (#main)
 └── ClerkProvider (env-gated) / Providers
      ├── QueryClientProvider (TanStack Query v5)
      ├── LanguageProvider (useSyncExternalStore, RTL sync)
      ├── ThemeProvider (useSyncExternalStore, dark class)
      ├── TooltipProvider
      └── Toaster (Sonner)
           └── DashboardLayout (apps/web/src/app/(dashboard)/dashboard/layout.tsx)
                ├── SessionProvider & SessionGate
                ├── ProvisioningGuard (checks firm-provisioning status)
                ├── InboxAlertWatcher (audio chime + tab title unread sync)
                ├── Desktop Sidebar (sticky w-64, DashboardNav, LanguageToggle)
                ├── Header (sticky h-14, hidden in /dashboard/inbox)
                │    ├── MobileNav (Sheet drawer)
                │    ├── HeaderWhatsappStatus (live connection badge)
                │    ├── LanguageToggle
                │    ├── ThemeToggle
                │    └── UserMenu (ClerkUserMenu or DevUserMenu)
                └── Main Content Area (<RouteGuard>{children}</RouteGuard>)
```

---

## 2. Screen-by-Screen Component Breakdown

### 2.1 Overview Screen (`/dashboard`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- **Component Composition:**
  - `PageHeader` (with title, description, and status badges)
  - `MetricCard` Grid (6 cards: Active Conversations, Needs Human, Appointments, Court Hearings, Pending Payments, Document Requests)
  - `SlaBanner` (appears when any escalation breaches SLA)
  - `AiControls` (global switches: AI Auto-Reply, Draft Approval Mode, Urdu Reply)
  - `FunnelStrip` (Lead → Qualified → Booked → Retained conversion rates)
  - `EscalationPreview` (top urgent unresolved escalations with quick links)
  - `TodaySchedule` (today's hearings and consultations)
  - `DocRequestsWidget` & `PaymentsFollowup` (unfulfilled client requests)
  - Launch Checklist & AI Guardrail Informational Cards

### 2.2 Priority Inbox Screen (`/dashboard/inbox`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/inbox/page.tsx`
- **Layout Behavior:** Full-bleed viewport (`inboxMode`, zero outer padding, inner scroll).
- **Component Composition:**
  - Left Pane (`conversation-list.tsx`, w-80 to w-96):
    - Search & filter bar (All, Needs human, AI active, Unread)
    - Virtualized conversation items with avatar initials, name, snippet, time, unread count
  - Right Pane (`conversation-detail.tsx`, flex-1):
    - Conversation Header: Client name, phone number, state badge, lawyer assignment dropdown, action menu
    - Safety Brief Banner (`HandoffBriefView`): Renders when state is `HUMAN_REQUIRED`
    - Message Thread (`.wa-thread` canvas):
      - Day divider chips (`shouldShowDayChip`)
      - Message bubbles (`.wa-in` client white, `.wa-out` firm emerald)
      - Audio note waveform player (`voice-note.tsx`)
      - Image & PDF media attachments
      - Delivery ticks (`DeliveryTicks`)
    - Lawyer Action Tray:
      - Internal Case Note drawer (`StickyNote`)
      - Convert to Case dialog (`Briefcase`)
      - AI Draft review & approval banner
      - Message composer with 24h window countdown warning

### 2.3 Escalations Screen (`/dashboard/escalations`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/escalations/page.tsx`
- **Component Composition:**
  - `PageHeader` with AlertTriangle glyph
  - Filter Tabs (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `ALL`)
  - Escalation Cards:
    - Trigger Badge (`POLICE_ARREST`, `DOMESTIC_VIOLENCE`, `SELF_HARM`, `TIGHT_DEADLINE`)
    - Client Info, Timestamp, SLA countdown badge
    - `HandoffBriefView`: Structured summary of facts and next actions
    - Action Buttons: `Acknowledge`, `Resolve`, `Open in Inbox`

### 2.4 Cases Screen (`/dashboard/cases`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/cases/page.tsx`
- **Component Composition:**
  - `PageHeader` with Briefcase glyph
  - Status Filter Pills (`ALL`, `LEAD`, `CONSULTATION`, `ENGAGED`, `IN_COURT`, `CLOSED`)
  - Matters Table:
    - Reference, Matter Type, Status Badge, Urgency, Opened Date
    - Status Transition Dropdown (`LEAD` → `CONSULTATION` → `ENGAGED` → `IN_COURT` → `CLOSED`)
  - `DocumentRequestsCard`: Inline document tracker for active matters

### 2.5 Calendar Screen (`/dashboard/calendar`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`
- **Component Composition:**
  - `PageHeader` with CalendarDays glyph
  - `CalendarConnectionCard`: Google Calendar OAuth connection status & sync button
  - Month Navigator (Prev, Next, Current Month label)
  - 6-Week Monday-First Calendar Grid (`gridCells`):
    - Day Cells with date numbers and consultation event chips
  - Book Appointment Dialog (`Dialog`):
    - Client selector, Lawyer selector, Start/End datetime inputs, Location, Notes

### 2.6 Documents Screen (`/dashboard/documents`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/documents/page.tsx`
- **Component Composition:**
  - `PageHeader` with FolderOpen glyph
  - Dual Mode Switcher: `By Client Folder` vs `By Case`
  - Client / Case Selector Dropdown
  - `DocumentManager`:
    - Upload Dropzone (PDF, DOCX, Images)
    - Document Table (Name, Type, Uploaded, Pinned status, Chunk status)
    - Action buttons: Pin for RAG, Download, Delete

### 2.7 Knowledge Base Screen (`/dashboard/knowledge`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/knowledge/page.tsx`
- **Component Composition:**
  - `PageHeader` with BookOpen glyph
  - "New Entry" Trigger & Collapsible Authoring Form
  - Knowledge Entries List:
    - Title, Category, Language badge (`EN` / `UR`)
    - Status badge (`DRAFT` / `PUBLISHED`)
    - Publish / Archive / Delete actions

### 2.8 Fee Collection Screen (`/dashboard/payments`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/payments/page.tsx`
- **Component Composition:**
  - Metric Cards (Total Collected, Pending Proofs, Unpaid Fees)
  - `PaymentReceivingDetailsCard`: AES-256-GCM encrypted bank and wallet details configuration
  - "Request Fee" Form & Modal
  - Payments Ledger Table:
    - Client, Matter, Amount (PKR), Method, Status, Screenshot proof trigger, "Verify & Issue PDF" action

### 2.9 Team & Availability Screen (`/dashboard/team`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/team/page.tsx`
- **Component Composition:**
  - Team Member Roster Table (Avatar, Name, Email, Role, Status)
  - Invite Modal (Name, Email, Role: Lawyer / Staff)
  - Advocate Availability Schedule Editor:
    - 7-day checkboxes (Mon–Sun) with Start Time, End Time, and Slot Duration inputs

### 2.10 Firm Settings Screen (`/dashboard/settings`)
- **Route:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
- **Component Composition:**
  - Multi-tab vertical/horizontal navigation (General, Firm, Owner, Payments, AI, Notifications)
  - Tab Panes:
    - `FirmProfileForm`: Legal name, city, address, practice areas, office hours
    - `OwnerProfileCard`: Senior partner bio, Bar council number, featured cases
    - `AiSettingsCard`: Tone, intro text, assumptions, ElevenLabs voice selection & preview
    - Notification Preferences: Dashboard, Web Push, WhatsApp alerts, Email digest switches
