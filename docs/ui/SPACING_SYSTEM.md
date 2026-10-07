# Wakeel — Spacing System & Layout Geometry

**Status:** IMPLEMENTED BASELINE & SPATIAL SPECIFICATION  
**Classification:** Layout Rhythm, Spatial Geometry, Component Paddings, and Layout Shell  
**Implementation Framework:** Tailwind CSS v4 4px Geometric Multiplier  

---

## 1. The 4px Base Spatial Rhythm

All spatial measurements (paddings, margins, gutters, heights, gaps) derive strictly from a **4px modular grid**. This eliminates visual drift and ensures mathematical alignment across multi-pane layouts:

| Token | Pixels | Rem Equivalent | Primary Architectural Usage |
|---|---|---|---|
| `space-1` | 4px | 0.25rem | Icon gaps, tight badge padding, chip margins. |
| `space-2` | 8px | 0.5rem | Button internal padding, small input gap, list item vertical margins. |
| `space-3` | 12px | 0.75rem | Compact card padding, table cell vertical padding, dropdown menu items. |
| `space-4` | 16px | 1.0rem | Standard card internal padding, dialog header gap, toolbar padding. |
| `space-6` | 24px | 1.5rem | Standard page gutter, section separation, metric card interior padding. |
| `space-8` | 32px | 2.0rem | Major section dividers, modal content separation. |
| `space-12` | 48px | 3.0rem | Landing page feature block spacing, dashboard group gap. |
| `space-16` | 64px | 4.0rem | Landing page hero vertical rhythm. |

---

## 2. Shell & Landmark Dimensions

| Structural Landmark | Dimension Token | Exact Value | Behavioral Rules |
|---|---|---|---|
| **Global Header Height** | `h-14` | 56px (3.5rem) | Sticky top, z-index 40, border bottom. Hidden in Priority Inbox mode (`inboxMode`). |
| **Desktop Sidebar Width** | `w-64` | 256px (16.0rem)| Sticky full-height (`h-svh`), hidden below `lg` breakpoint. |
| **Priority Inbox List Width** | `w-80` to `w-96` | 320px–384px | Scrollable conversation list pane. Collapses to 100% on mobile. |
| **Max Content Container** | `max-w-[1440px]` | 1440px | Horizontally centered (`mx-auto`) across all non-inbox dashboard pages. |
| **Reading Text Constrain** | `max-w-3xl` | 768px | Constrains long-form case notes, handoff briefs, and legal terms for optimal readability. |

---

## 3. Component Interior Padding Standards

```text
1. Buttons:
   - xs: h-6 px-2 text-xs gap-1
   - sm: h-7 px-2.5 text-xs gap-1
   - default: h-8 px-2.5 text-sm gap-1.5
   - lg: h-9 px-2.5 text-sm gap-1.5

2. Input Fields & Textareas:
   - Input: h-8 px-2.5 py-1 text-sm
   - Textarea: min-h-16 px-2.5 py-2 text-sm

3. Table Cells:
   - Header: h-9 px-3 text-xs font-medium text-muted-foreground
   - Body Row: h-12 px-3 text-sm border-b

4. Standard Card:
   - Header: px-4 pt-4 pb-2
   - Content: px-4 pb-4
   - Footer: px-4 pb-4 pt-0
```
