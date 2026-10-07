# Wakeel — Loading States & Skeleton Architecture

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Loading States, Asynchronous Indicators, and Skeleton Patterns  
**Source Code References:** `apps/web/src/components/ui/skeleton.tsx`, `apps/web/src/app/(dashboard)/dashboard/`  

---

## 1. Zero Cumulative Layout Shift (CLS) Mandate

In legal applications, layout shifts during data loading can lead to dangerous errors—such as clicking the wrong client row or triggering the wrong status action.

### Core Commandments
1. **Dimension Parity:** Skeletons must exactly match the height, width, and padding of the incoming data components.
2. **Smooth Pulsing Over Aggressive Spinners:** Full-page content uses gentle pulsing skeletons (`animate-pulse bg-muted`). Spinners (`Loader2`) are reserved exclusively for inline mutation buttons.
3. **Optimistic Updates Where Safe:** Conversation state transitions (`AI_ACTIVE` → `HUMAN_ACTIVE`) apply immediate local cache updates with automatic rollback on mutation failure.

---

## 2. Skeleton Component Implementations

### 2.1 Table Row Skeletons (`cases/page.tsx`, `payments/page.tsx`)
```tsx
{query.isPending && (
  <div className="space-y-2" aria-busy="true">
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-10 w-full rounded-md" />
    ))}
  </div>
)}
```
- Replaces the `TableBody` with 4 to 6 uniform 40px rounded bars, preventing table collapse.

### 2.2 Metric Card Skeletons (`MetricCard`)
- Renders an elevated card container with a 36×36px square placeholder for the icon tile and two horizontal bars (24px for number, 14px for label).

### 2.3 Conversation List Skeletons (`conversation-list.tsx`)
- Renders 6 stacked conversation item placeholders: 44px circular avatar placeholder on the left, dual text lines in the center, and a small timestamp box on the right.

### 2.4 Calendar Grid Skeletons (`calendar/page.tsx`)
- Maintains the exact 42-cell (6×7) grid layout with subtle muted background blocks, guaranteeing zero calendar jumps when changing months.

---

## 3. Button Mutation Loading States

When an advocate triggers an asynchronous operation (e.g. "Save Changes", "Verify Payment", "Invite Member"):
- The button enters `disabled` state (`disabled:pointer-events-none disabled:opacity-50`).
- The leading icon replaces with an animated spinning glyph: `<Loader2 className="h-4 w-4 animate-spin text-current" />`.
- Button label shifts to present participle (e.g., `"Saving..."`, `"Verifying..."`, `"Sending..."`).
