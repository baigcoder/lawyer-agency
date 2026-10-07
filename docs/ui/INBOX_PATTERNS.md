# Wakeel — Priority Inbox Patterns & Architecture

**Status:** IMPLEMENTED BASELINE & OPERATIONAL SPECIFICATION  
**Classification:** Priority Inbox Layout, Conversation List, and Advocate Workflows  
**Source Code References:** `apps/web/src/app/(dashboard)/dashboard/inbox/page.tsx`, `apps/web/src/components/inbox/`  

---

## 1. Full-Screen "Inbox Mode" Architecture

To provide an authentic, distraction-free messaging console for legal triage, the Priority Inbox implements **Inbox Mode** (`apps/web/src/app/(dashboard)/dashboard/layout.tsx`):
- When `pathname === '/dashboard/inbox'`:
  - Outer dashboard header is suppressed (`inboxMode ? null : <header>`).
  - Outer layout margins and paddings collapse to 0 (`p-0`).
  - Container locks to viewport height: `h-svh min-h-0 overflow-hidden`.
  - Content occupies 100% of the remaining horizontal space alongside the desktop sidebar.

---

## 2. Left-Hand Conversation Queue (`conversation-list.tsx`)

### 2.1 Dimensions & Styling
- Width: `w-80` (320px) on laptops, expanding to `w-96` (384px) on wide monitors.
- Background: `var(--wa-list-bg)` (`#ffffff` light, `#111b21` dark).
- Divider: `border-e` with `var(--wa-border)` (`#e9edef` light, `#222d34` dark).

### 2.2 Filter Toolbar & Search
- Quick Filter Chips:
  - `All` — Total firm conversations.
  - `Needs human` — Filtered by `state === 'HUMAN_REQUIRED'` (safety escalations, complex questions, auto-reply disabled).
  - `AI active` — Filtered by `state === 'AI_ACTIVE'` (active automated intake / FAQ).
  - `Unread` — Filtered by `unreadCount > 0`.
- In-Memory Search: Searches client full name and telephone number.

### 2.3 Conversation List Item Geometry
Each conversation row is rendered at a compact height of 72px:
- **Leading:** Circular avatar (44×44px) with dynamic pastel background derived from phone number hash (`waAvatarColor`) and initials (`waInitials`).
- **Body:** Client name / phone number on line 1; truncated message preview on line 2.
- **Trailing:** Monospaced clock timestamp (`formatWaClock`) on line 1; green unread badge (`--wa-unread`) or delivery tick on line 2.

---

## 3. Real-Time Alerting & Sound Notifications

1. **Audio Chime Watcher (`inbox-alert-watcher.tsx`):**
   - Monitors incoming messages and newly created escalations using TanStack Query poll intervals (5,000ms).
   - Synthesizes a discrete, dignified two-tone chime via the Web Audio API (`inbox-alert-sound.ts`) when an unread message arrives or an emergency escalation triggers.
2. **Browser Tab Title Synchronization (`inbox-unread.ts`):**
   - Updates document title to include unread counts: `"(3) Wakeel · Priority Inbox"`.

---

## 4. In-Inbox Legal Tools

- **Internal Case Notes (`StickyNote`):** Allows advocates and clerks to attach private, advocate-only collaboration notes (`app.conversation_notes`) to a client thread without client visibility.
- **Convert to Case (`Briefcase`):** Directly converts a qualified conversation into an official firm matter (`app.cases`), retaining all facts, phone numbers, and documents.
- **AI Draft Review Banner:** When `aiAutoReplyRequiresApproval` is active, displays the proposed AI response in a highlighted amber box with "Edit", "Reject", and "Approve & Send" actions.
