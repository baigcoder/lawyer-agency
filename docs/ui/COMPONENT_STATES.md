# Wakeel — Component States Specification

**Status:** IMPLEMENTED BASELINE & INTERACTION SPECIFICATION  
**Classification:** Micro-Interaction States, Focus Rings, and Status Modifiers  
**Implementation Technology:** Tailwind v4, CSS pseudo-classes, Base UI data attributes  

---

## 1. Global Interaction Matrix

Every interactive component in Wakeel must implement a complete set of deterministic states:

```text
┌───────────┐    Hover     ┌───────────┐    Press     ┌───────────┐
│  DEFAULT  │ ───────────► │   HOVER   │ ───────────► │  ACTIVE   │
└───────────┘              └───────────┘              └───────────┘
      │                          │                          │
      │ Focus                    │ Tab                      │ Release
      ▼                          ▼                          ▼
┌───────────┐              ┌───────────┐              ┌───────────┐
│   FOCUS   │              │ FOCUS-VIS │              │  DEFAULT  │
│ (Visible) │              │  (Ring)   │              │           │
└───────────┘              └───────────┘              └───────────┘
```

---

## 2. State Specifications by Component Family

### 2.1 Buttons (`Button`)
- **Default:** Clean, flat surface with crisp text and 1px border (`border-transparent` on default variant).
- **Hover:** Slight background opacity step (`hover:bg-primary/80` or `hover:bg-muted`).
- **Active / Pressed:** Subtle 1px downward translation: `active:not-aria-[haspopup]:translate-y-px`.
- **Focus-Visible:** High-contrast 3px focus ring: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none`.
- **Disabled:** Pointer events locked, opacity reduced: `disabled:pointer-events-none disabled:opacity-50`.
- **Invalid / Error:** Red border and ring: `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20`.

### 2.2 Text Inputs & Textareas (`Input`, `Textarea`)
- **Default:** Crisp neutral border `border-input` on transparent background.
- **Hover:** Border shifts slightly darker (`hover:border-input/80`).
- **Focus:** Border transitions to primary ring color (`focus-visible:border-ring focus-visible:ring-3`).
- **Invalid:** Red border with error text beneath: `aria-invalid:border-destructive text-destructive`.
- **Disabled:** `disabled:cursor-not-allowed disabled:opacity-50 bg-muted/50`.

### 2.3 Table Rows (`TableRow`)
- **Default:** Transparent background with bottom border `border-b border-border`.
- **Hover:** Background tint `hover:bg-muted/50`.
- **Selected:** Accent tint `bg-accent/40 text-accent-foreground`.

### 2.4 Toggle Switches (`Switch`)
- **Unchecked (Off):** Track background `bg-input` with white thumb at start position.
- **Checked (On):** Track background transitions to emerald `bg-primary` with thumb translated to end position.
- **Focus-Visible:** Ring wraps track container.
- **Disabled:** Opacity 50%, non-clickable.

### 2.5 Data Loaders & Skeletons (`Skeleton`)
- **Loading State:** Rectangular block with rounded corners and pulsing opacity animation (`animate-pulse bg-muted`).
- **Table Skeleton:** 4 to 6 skeleton rows stacked vertically while data query is pending.
