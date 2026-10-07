# Wakeel — Design System Specification

**Status:** IMPLEMENTED BASELINE & DESIGN SYSTEM ARCHITECTURE  
**Classification:** Design System Architecture, Components, and Guidelines  
**Implementation Foundation:** Next.js 16, Tailwind CSS v4, `@base-ui/react`, OKLCH  

---

## 1. System Philosophy: Institutional Legal Restraint

The Wakeel Design System is purpose-built for law practices in Pakistan. It rejects modern SaaS trends that emphasize consumer gamification, playful animations, or noisy illustrations. Instead, it prioritizes:
1. **Dignified Authority:** Typography, colors, and layout reflect the sober reality of legal practice and judicial decorum.
2. **High-Information Density:** Enables legal professionals to view and act upon complex multi-party matters without unnecessary scrolling.
3. **Bilingual Elegance:** Simultaneous, seamless support for English (Latin) and Urdu (Arabic/Nastaliq) across all UI components.

---

## 2. Design System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   WAKEEL DESIGN SYSTEM                 │
├────────────────────────────────────────────────────────┤
│ 1. DESIGN TOKENS (CSS Custom Properties in OKLCH)      │
│    • Color System (Light / Dark / Status / WhatsApp)   │
│    • Typographic Scale & Font Families                 │
│    • Spacing Rhythm (4px base) & Radii Tokens          │
├────────────────────────────────────────────────────────┤
│ 2. BASE UI PRIMITIVES (@base-ui/react)                 │
│    • Button, Dialog, DropdownMenu, Select, Switch      │
│    • Native button rendering via render prop           │
│    • Deterministic data-slot styling                   │
├────────────────────────────────────────────────────────┤
│ 3. CORE DOMAIN ATOMS & MOLECULES                       │
│    • PageHeader, MetricCard, DeliveryTicks             │
│    • HandoffBriefView, StatusBadge, VoiceNote          │
├────────────────────────────────────────────────────────┤
│ 4. OPERATIONAL PATTERNS & VIEWS                        │
│    • Priority Inbox (Split-pane WhatsApp Web)          │
│    • Legal Matter Tables & Court Diary Cards           │
│    • Consultation Calendar (6-week grid + OAuth Sync)  │
│    • Fee Collection & PDF Receipt Verifier             │
└────────────────────────────────────────────────────────┘
```

---

## 3. Core Component Library Inventory

| Component Name | File Path | Primitive Basis | Purpose & Behavior |
|---|---|---|---|
| `Button` | `apps/web/src/components/ui/button.tsx` | `@base-ui/react/button` | Primary, secondary, outline, ghost, destructive, link variants. Supports `render` prop. |
| `Dialog` | `apps/web/src/components/ui/dialog.tsx` | `@base-ui/react/dialog` | Accessible modal dialog with backdrop blur and zoom animations. |
| `DropdownMenu` | `apps/web/src/components/ui/dropdown-menu.tsx` | `@base-ui/react/menu` | Action menus, filter selections, user account dropdowns. |
| `Select` | `apps/web/src/components/ui/select.tsx` | `@base-ui/react/select` | Styled dropdown pickers for lawyer assignment, status transitions, matter types. |
| `Switch` | `apps/web/src/components/ui/switch.tsx` | `@base-ui/react/switch` | Accessible toggles for AI auto-reply, approval mode, and notification channels. |
| `Table` | `apps/web/src/components/ui/table.tsx` | Semantic HTML `<table>` | Dense tabular presentation with hover rows and monospaced codes. |
| `Card` | `apps/web/src/components/ui/card.tsx` | `<div>` | Standard content card with header, description, and footer sections. |
| `Badge` | `apps/web/src/components/ui/badge.tsx` | `<span>` | Matter tags, urgency chips, connection statuses, delivery state pills. |
| `Field` | `apps/web/src/components/ui/field.tsx` | `<div>` + `<label>` | Form field wrapper with label, error display, and description slot. |
| `Skeleton` | `apps/web/src/components/ui/skeleton.tsx` | `<div>` | Animated pulsing loading placeholders for data fetching states. |
| `Toaster` | `apps/web/src/components/ui/sonner.tsx` | `sonner` | Rich toast notifications for confirmations, errors, and background sync alerts. |

---

## 4. Design Guidelines for New Interfaces

When authoring new views or modifying existing components in Wakeel:
1. **Never use ad-hoc color classes** like `text-red-500` or `bg-green-600`. Always use design system tokens (`text-destructive`, `bg-primary`, `bg-sidebar-accent`).
2. **Always support dark mode** by verifying token contrast against zinc-950 surfaces.
3. **Always test in RTL mode (`dir="rtl"`)** with Urdu enabled to ensure flex margins, icons, and text alignments mirror cleanly without clipping.
4. **Ensure form inputs use `Field` wrappers** with associated Zod validation schemas.
