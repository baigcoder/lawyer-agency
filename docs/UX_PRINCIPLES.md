# Wakeel — UX Principles

**Status:** IMPLEMENTED BASELINE & DESIGN MANDATE  
**Classification:** User Experience Philosophy & Interface Standards  
**Target Personas:** Senior Partners, Junior Associates, Court Clerks (*Munshis*), and Practice Managers  

---

## 1. Calm, Dignified Legal Technology

### Principle
Lawyers work in high-stress, contentious environments. The software they look at all day must be an oasis of order, clarity, and calm—never an aggressive, hyperactive SaaS product.

### Design Standards
- **No Flashy "AI Startup" Gimmicks:** Avoid glowing neon borders, gratuitous gradients, floating chatbot bubbles, and pulsing sparkles. Wakeel is serious infrastructure for advocates of the High Court and Supreme Court.
- **Deep Muted Tones with High Contrast:** In light mode, crisp warm whites (`oklch(0.99 0.002 250)`) with deep slate text (`oklch(0.15 0.01 260)`) and authoritative emerald legal accents (`oklch(0.6 0.19 152)`). In dark mode, near-black zinc (`oklch(0.145 0.005 285)`) with balanced emerald highlights (`oklch(0.7 0.17 162)`).
- **Predictable, Stable Layouts:** No shifting UI elements, layout reflows, or unexpected dialog popups during active message reading or drafting.

---

## 2. Density Where Operational, Spacious Where Cognitive

### Principle
Legal casework requires scanning dozens of records quickly, while reading client handoff briefs and drafting court pleadings requires deep focus and breathing room.

### Dual-Density Strategy
1. **High-Density Operational Areas (Compact & Fast):**
   - **Conversation List & Priority Inbox:** 48–56px row heights with condensed metadata (timestamp, unread badge, matter chip, client initials).
   - **Cases & Matters Table:** Clean columnar alignment, monospaced case reference numbers (`CR-2026-0812`), status badges, and inline status dropdowns.
   - **Calendar Day/Week Grids:** Compact appointment blocks showing client name, lawyer initials, and time ranges.
2. **Spacious Cognitive Areas (Focused & Legible):**
   - **Lawyer Handoff Brief (`HandoffBriefView`):** Clear section dividers, elevated cards for trigger reasons, highlighted urgent deadlines, and distinct bullet points for client-disclosed facts.
   - **Legal Pleading & Case Notes Review:** Generous line heights, constrained reading column widths (max 720px for text bodies), and distraction-free backgrounds.

---

## 3. Bilingual Parity: First-Class English and Urdu (Nastaliq)

### Principle
Urdu is not an afterthought or an auto-translated string dump. It is an official national language of Pakistan with unique typographic, grammatical, and layout requirements.

### Typography & Bi-Directionality Rules
- **Native Nastaliq Support:** Urdu is rendered using **Noto Nastaliq Urdu** with customized line-height multipliers (`line-height: 2.1` in `.font-urdu`) to prevent character overlap, diacritic (*a’raab*) clipping, and ascender truncation.
- **True RTL Layout Inversion:** Switching to Urdu toggles `dir="rtl"` across the root document. Sidebars, navigation items, metric indicators, back buttons, and message bubbles mirror cleanly.
- **Script-Aware Message Formatting:** When an Urdu message appears in an English interface (or vice versa), the message bubble automatically applies the correct font family and direction without breaking the overall page alignment.

---

## 4. Keyboard First & Instant Retrieval

### Principle
Advocates and legal clerks value speed. Navigating between conversations, toggling filters, and approving drafts should never require repetitive precision mouse clicks.

### Interaction Standards
- **Global Shortcuts (Planned & Target):**
  - `/` — Focus global search (cases, clients, WhatsApp messages).
  - `J` / `K` — Navigate down / up through the priority conversation list.
  - `E` — Transition current conversation to `HUMAN_ACTIVE`.
  - `A` — Approve pending AI draft reply.
  - `Esc` — Close overlays, exit search, or return to list view.
- **Persistent Skip Links:** Accessible `"Skip to content"` link anchored as the first focusable element (`RootLayout`).

---

## 5. Explicit State Visibility: Never Leave the Advocate Wondering

### Principle
Lawyers operate under court filing deadlines and legal statutes of limitation. The system must never be ambiguous about message delivery, AI status, or sync progress.

### Visual State Rules
- **WhatsApp Delivery Ticks:** Every outbound message displays authentic delivery status:
  - Single gray check (`Check`): Sent from Wakeel to transport.
  - Double gray check (`CheckCheck`): Delivered to client device.
  - Double cyan check (`CheckCheck` in `#53bdeb`): Read by client.
  - Clock icon (`Clock`): Queued in outbox.
  - Red exclamation (`!`): Delivery failed with tooltip error explanation.
- **24-Hour Window Countdown:** Visible badge displaying remaining hours/minutes of the open session window before template-only restrictions apply.
- **Escalation SLA Timers:** Bright red/amber timers displaying time elapsed since an automated escalation was triggered against the configured SLA (`aiHandoffSlaMinutes`).

---

## 6. Mobile Ergonomics for the Courthall Advocate

### Principle
Advocates are frequently at the City Courts, High Court bar room, or travelling between hearings. Mobile dashboard UX must be fully operational, not a degraded read-only view.

### Mobile Standards
- **One-Thumb Operation:** Primary touch targets (accept escalation, approve draft, call client) maintain minimum 44×44px hit boxes.
- **Swipe Actions & Sheet Drawers:** Navigation transforms into bottom sheet drawers (`MobileNav`) with gesture dismissals.
- **Adaptive Split-Pane:** On desktop, inbox shows side-by-side list and thread; on mobile, it transitions to a stack pattern with an instant back button (`ArrowLeft`).
