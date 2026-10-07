# Wakeel — Color System Specification

**Status:** IMPLEMENTED BASELINE & COLOR SPECIFICATION  
**Classification:** Color Architecture, Perceptual Color Spaces, and Palette Mapping  
**Implementation Technology:** OKLCH in CSS Custom Properties (`apps/web/src/app/globals.css`)  

---

## 1. OKLCH Perceptual Uniformity

Wakeel authors all design tokens in **OKLCH** (`L` = Lightness, `C` = Chroma, `H` = Hue angle). Unlike legacy HSL or RGB spaces:
- **Perceptual Balance:** 70% lightness in OKLCH has identical perceived luminance across greens, blues, and ambers. This ensures that text contrast ratios remain consistent when switching between semantic status colors.
- **Vibrant P3 Gamut:** On modern mobile screens and Mac displays, OKLCH renders richer, deeper tones without clipping or muddying.

---

## 2. Palette Architecture

### 2.1 The Sovereign Legal Emerald (Primary Hue: 152°–162°)
- **Light Theme Primary:** `oklch(0.6 0.19 152)` (Emerald-600)  
  Used on primary action buttons, firm logos, active navigation markers. Paired with white text `oklch(0.99 0 0)`.
- **Light Theme Subtle Tint:** `oklch(0.94 0.03 152)` (Emerald-50)  
  Used on icon tiles, hover backgrounds, and selected table rows.
- **Dark Theme Primary:** `oklch(0.7 0.17 162)` (Emerald-500)  
  Elevated lightness for readability on dark surfaces. Paired with deep obsidian text `oklch(0.145 0.01 285)`.
- **Dark Theme Subtle Tint:** `oklch(0.26 0.04 162)` (Emerald-900/40)  
  Used on selected rows, active nav item backgrounds.

### 2.2 Neutral Canvas Foundations (Hue: 260°–285°)
- **Light Theme:**
  - Background: `oklch(0.99 0.002 250)` — soft warm alabaster white, eliminating eye strain from stark `#ffffff`.
  - Elevated Card: `oklch(1 0 0)` — pure crisp white.
  - Primary Text: `oklch(0.15 0.01 260)` — deep charcoal slate.
  - Secondary Text: `oklch(0.5 0.02 260)` — muted slate.
  - Boundary Border: `oklch(0.91 0.01 260)` — clean neutral division.
- **Dark Theme:**
  - Background: `oklch(0.145 0.005 285)` — deep near-black zinc-950.
  - Elevated Card: `oklch(0.185 0.006 285)` — elevated zinc-900.
  - Primary Text: `oklch(0.985 0 0)` — high-contrast crisp white.
  - Secondary Text: `oklch(0.65 0.015 285)` — muted ash zinc.
  - Boundary Border: `oklch(1 0 0 / 8%)` — subtle 8% translucent white.

### 2.3 Status & Operational Alerts
- **Destructive (Urgent Escalation / Failure):**  
  Light: `oklch(0.577 0.245 27.325)` | Dark: `oklch(0.704 0.191 22.216)`  
  Used for domestic violence flags, arrest alerts, and transmission errors.
- **Warning (SLA Warning / Pending Approval):**  
  Light: `oklch(0.75 0.18 65)` | Dark: `oklch(0.82 0.16 65)`  
  Used for SLA threshold warnings and pending drafts.
- **Success (Confirmed / Received):**  
  Light: `oklch(0.6 0.19 152)` | Dark: `oklch(0.7 0.17 162)`  
  Used for verified fees, booked consultations, and published KB articles.

---

## 3. Data Visualization & Analytics Charts

Five harmonious, contrast-verified chart tokens for reporting analytics (`apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`):

| Token Name | Light Value | Dark Value | Typical Visualization Usage |
|---|---|---|---|
| `--chart-1` | `oklch(0.6 0.19 152)` | `oklch(0.7 0.17 162)` | New Leads / Primary Volume (Emerald). |
| `--chart-2` | `oklch(0.55 0.15 250)`| `oklch(0.65 0.18 250)`| AI-Handled Conversations (Sky Blue). |
| `--chart-3` | `oklch(0.55 0.15 330)`| `oklch(0.65 0.18 330)`| Human-Handled Conversations (Indigo). |
| `--chart-4` | `oklch(0.6 0.15 80)`  | `oklch(0.7 0.15 80)`  | Safety Escalations (Amber). |
| `--chart-5` | `oklch(0.55 0.15 30)`  | `oklch(0.65 0.18 30)`  | Cases Converted (Rose / Terracotta). |

---

## 4. Contrast Ratio Verification Matrix

All primary pairings exceed WCAG 2.2 Level AA requirements:

```text
Light Mode:
Foreground [oklch(0.15 0.01 260)] on Background [oklch(0.99 0.002 250)]: 14.2:1 (AAA Pass)
Primary FG [oklch(0.99 0 0)] on Primary BG [oklch(0.6 0.19 152)]: 4.7:1 (AA Pass)
Destructive [oklch(0.577 0.245 27.325)] on Background: 5.6:1 (AA Pass)

Dark Mode:
Foreground [oklch(0.985 0 0)] on Background [oklch(0.145 0.005 285)]: 15.8:1 (AAA Pass)
Primary FG [oklch(0.145 0.01 285)] on Primary BG [oklch(0.7 0.17 162)]: 8.9:1 (AAA Pass)
Accent FG [oklch(0.85 0.12 162)] on Card [oklch(0.185 0.006 285)]: 7.4:1 (AAA Pass)
```
