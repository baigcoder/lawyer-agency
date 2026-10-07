# Wakeel — Design Principles

**Status:** IMPLEMENTED BASELINE & DESIGN SYSTEM SPECIFICATION  
**Classification:** Visual Language, Design Architecture, and Token Strategy  
**Implementation Source:** `apps/web/src/app/globals.css`, `apps/web/src/components/ui/`

---

## 1. Visual Hierarchy & Legal Gravitas

Wakeel’s visual system is rooted in legal authority, clarity, and institutional restraint. It takes inspiration from venerable legal publications, classic editorial typography, and high-performance financial terminals.

### Core Commandments
1. **Content Over Chrome:** Borders, container backgrounds, and drop shadows must recede into the canvas so legal text, party names, and document attachments take precedence.
2. **Structural Harmony:** Maintain a strict 4px/8px spatial rhythm across all layouts. Every padding, margin, height, and gap token is derived from multiples of 4px.
3. **Subtle Elevation Over Heavy Shadows:** Layering is expressed via subtle border contrasts (`border-border`) and slight tonal step-ups (`--card` vs `--background`), minimizing heavy, noisy drop shadows.

---

## 2. Color Palette & Tonal Strategy

The palette is authored in modern **OKLCH** color space for perceptual uniformity and consistent contrast ratios across light and dark modes.

### 2.1 The Signature Legal Emerald
Emerald evokes trust, prosperity, and institutional reliability. It is the signature hue of the Pakistani state and legal emblem.
- **Light Primary:** `oklch(0.6 0.19 152)` — authoritative emerald-600.
- **Light Accent / Soft Highlight:** `oklch(0.94 0.03 152)` / foreground `oklch(0.35 0.08 152)`.
- **Dark Primary:** `oklch(0.7 0.17 162)` — vibrant emerald-500 optimized for dark backgrounds.
- **Dark Accent / Soft Highlight:** `oklch(0.26 0.04 162)` / foreground `oklch(0.85 0.12 162)`.

### 2.2 Neutral Canvas Foundations
- **Light Surface:** Clean warm white `oklch(0.99 0.002 250)` with crisp zinc foreground `oklch(0.15 0.01 260)`. Card surfaces rest on pure white `oklch(1 0 0)` with fine `oklch(0.91 0.01 260)` borders.
- **Dark Surface:** Deep obsidian zinc `oklch(0.145 0.005 285)` (zinc-950) with high-contrast text `oklch(0.985 0 0)`. Card surfaces use elevated zinc `oklch(0.185 0.006 285)` with 8% white translucent borders (`oklch(1 0 0 / 8%)`).

### 2.3 Semantic Status Palette
- **Destructive / Urgent Escalation:** `oklch(0.577 0.245 27.325)` (light) / `oklch(0.704 0.191 22.216)` (dark). Used for domestic violence alerts, arrest notices, and failed sends.
- **Warning / Review Required:** Amber `oklch(0.75 0.18 65)` / `oklch(0.82 0.16 65)`. Used for approaching SLA breaches and pending draft approvals.
- **Success / Completed:** Emerald `oklch(0.6 0.19 152)` / `oklch(0.7 0.17 162)`. Used for confirmed appointments, paid fees, and published KB articles.
- **Informational / Lead:** Sky/Slate `oklch(0.65 0.15 240)`. Used for general enquiries and new unassigned conversations.

---

## 3. Typographic System & Multi-Script Composition

Wakeel uses a deliberate three-tier typographic family:
1. **Primary Interface:** **Inter** (`--font-inter`) for crisp Latin UI labels, metrics, and dense tables.
2. **Monospace Operational:** **Geist Mono** (`--font-geist-mono`) for case reference numbers (`CR-2026-0812`), timestamps, monetary amounts, and phone numbers (`+92 300 1234567`).
3. **National Urdu Script:** **Noto Nastaliq Urdu** (`--font-urdu-nastaliq`) with specialized CSS utilities (`.font-urdu` with `line-height: 2.1`) for authentic Urdu rendering.

### Typographic Scale
| Scale Token | Font Size | Line Height | Tracking | Recommended Usage |
|---|---|---|---|---|
| `text-xs` | 12px (0.75rem) | 16px (1.0rem) | +0.02em | Metadata, timestamp, table headers, badges. |
| `text-sm` | 14px (0.875rem) | 20px (1.25rem) | normal | Standard table body, button labels, input fields. |
| `text-base` | 16px (1.0rem) | 24px (1.5rem) | normal | Chat message bubbles, long-form handoff briefs. |
| `text-lg` | 18px (1.125rem) | 28px (1.75rem) | -0.01em | Card headings, modal dialog titles. |
| `text-xl` | 20px (1.25rem) | 28px (1.75rem) | -0.02em | Section headers, drawer titles. |
| `text-2xl` | 24px (1.5rem) | 32px (2.0rem) | -0.03em | Page titles, major dashboard stat numbers. |
| `text-3xl` | 30px (1.875rem) | 36px (2.25rem) | -0.03em | Key revenue figures, hero callouts. |

---

## 4. Base UI & Component Composition Philosophy

Wakeel leverages **shadcn UI on @base-ui/react primitives** rather than Radix UI:
- **`render` Prop Composition:** Base UI avoids the legacy `asChild` cloning anti-pattern, providing clean element rendering and avoiding React 19 forwardRef warnings.
- **Native Semantic Elements:** Buttons render as real `<button>` elements (`nativeButton={true}`) or pass custom tags cleanly through `render={<Link href="..." />}`.
- **Deterministic Accessible Slots:** All primitives export explicit `data-slot` attributes (`data-slot="button"`, `data-slot="dialog"`, etc.), enabling scoped CSS styling and robust test selectors.

---

## 5. Motion & Micro-Interactions

### Principle: Subservient Motion
Motion exists only to convey spatial relationships and state changes. It is never decorative.

- **Duration:** Standard transitions are between 100ms and 150ms. No animation exceeds 200ms.
- **Timing:** Ease-out cubic curves for arrivals (`ease-out`), ease-in for exits (`ease-in`).
- **Full Reduced-Motion Conformance:** A global media query override in `globals.css` collapses animation and transition durations to 0.01ms when `prefers-reduced-motion: reduce` is detected.
