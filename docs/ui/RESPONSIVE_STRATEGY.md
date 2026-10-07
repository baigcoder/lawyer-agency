# Wakeel — Responsive Strategy & Breakpoint Architecture

**Status:** IMPLEMENTED BASELINE & RESPONSIVE SPECIFICATION  
**Classification:** Screen Adaptation, Breakpoint System, and Device Ergonomics  
**Implementation Baseline:** Tailwind v4, `@base-ui/react`, CSS Viewport Units (`svh`, `dvh`)  

---

## 1. Breakpoint Taxonomy

Wakeel uses Tailwind v4 standard responsive breakpoints tailored for legal workstation monitors, courtroom tablets, and mobile smartphones:

| Breakpoint | Minimum Width | Primary Device Targets | Layout Behavior |
|---|---|---|---|
| **Base (Mobile)** | `0px` | iPhone, Android smartphones (+92 mobile users) | Single-column stack, mobile drawer, full-screen inbox toggle. |
| **`sm`** | `640px` | Large smartphones in landscape, small tablets | 2-column metric cards, expanded dialog widths. |
| **`md`** | `768px` | iPad, Galaxy Tab (courtroom reading) | 3-column metric cards, filter bars expand horizontally. |
| **`lg`** | `1024px` | Laptops (13-inch MacBook, ThinkPad) | Fixed sticky sidebar appears (`w-64`), inbox split-pane unlocks. |
| **`xl`** | `1280px` | Desktop monitors (1080p workstations) | 4-column metric grids, full multi-column legal tables. |
| **`2xl`** | `1536px` | Ultra-wide partner displays (1440p / 4K) | Max-content container width `max-w-[1440px]` with centered alignment. |

---

## 2. Priority Inbox Dual-Pane Adaptation

The Priority Inbox (`/dashboard/inbox`) features specialized responsive behavior to ensure advocates can triage conversations in the courthouse corridors:

```text
DESKTOP (lg and above, >= 1024px):
┌────────────────────────┬───────────────────────────────────────────┐
│ Conversation List      │ Active Conversation Detail                │
│ (w-80 or w-96, scroll) │ (flex-1, header, thread, composer)        │
└────────────────────────┴───────────────────────────────────────────┘

MOBILE (below 1024px):
┌────────────────────────────────────────────────────────────────────┐
│ VIEW A: Conversation List (w-full)                                 │
│ [Tap on a thread] ───────────────────────────────►                 │
│                                VIEW B: Conversation Detail (w-full)│
│                                [◄ Tap Back Button] ────────────────│
└────────────────────────────────────────────────────────────────────┘
```

- **Mobile View Switching:** When an advocate selects a conversation on a smartphone, the list view slides out and the detail view occupies 100% of the viewport.
- **Top Back Button:** Mobile conversation header displays an prominent `ArrowLeft` button (`onBack={() => setSelectedId(null)}`).
- **Full Viewport Sizing (`h-svh`):** Uses small viewport height (`h-svh`) to prevent mobile browser address bar jumps and keyboard layout breaks.

---

## 3. Legal Tables & Data Dense Layouts

Tables containing legal records (Cases, Court Diary, Payments Ledger, Team Roster) follow a progressive degradation pattern:

1. **Desktop (`>= 1024px`):** Full tabular presentation with fixed column headers, monospace case reference codes, badges, dates, and inline action dropdowns.
2. **Tablet (`768px - 1023px`):** Horizontal scroll with subtle sticky first columns (case reference / client name).
3. **Mobile (`< 768px`):** Tables gracefully transition to structured card lists. Each card highlights the primary identifier (Case reference), status badge, matter type, and a tap target to open the full drawer view.

---

## 4. Modal Dialogs & Bottom Drawers

- **Desktop:** Dialogs render centered on screen (`max-w-md` or `max-w-lg`) with backdrop blur (`supports-backdrop-filter:backdrop-blur-xs`).
- **Mobile:** Complex forms (e.g., Book Consultation, Request Fee, Upload Document) adapt to bottom sheet drawers that anchor to the bottom edge of the screen, providing thumb-accessible form inputs.
