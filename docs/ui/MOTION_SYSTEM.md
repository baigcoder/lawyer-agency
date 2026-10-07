# Wakeel — Motion System Specification

**Status:** IMPLEMENTED BASELINE & MOTION SPECIFICATION  
**Classification:** Animation Curves, Transition Durations, and Reduced-Motion Guardrails  
**Implementation Source:** `apps/web/src/app/globals.css`, `tw-animate-css`  

---

## 1. Motion Philosophy: Restraint & Purpose

In a legal operating platform, motion is strictly functional. It exists exclusively to:
1. Orient the advocate spatially during view transitions (e.g. mobile drawer sliding in from the edge).
2. Confirm user intent during destructive or critical actions (e.g. modal popups).
3. Soften data loading arrivals to prevent visual jarring (e.g. skeleton pulsing and table fades).

**Forbidden:** Bouncing animations, playful spring physics, floating decorative elements, continuous looping badges.

---

## 2. Duration & Timing Scale

| Token | Duration (ms) | Easing Curve | Semantic Usage |
|---|---|---|---|
| `duration-fast` | 100ms | `cubic-bezier(0, 0, 0.2, 1)` (ease-out) | Button hovers, toggle switches, tab selection indicators. |
| `duration-normal`| 150ms | `cubic-bezier(0, 0, 0.2, 1)` (ease-out) | Dropdown menu popovers, tooltips, toast entry. |
| `duration-enter` | 200ms | `cubic-bezier(0, 0, 0.2, 1)` (ease-out) | Modal dialog entry (`zoom-in-95`, `fade-in-0`), slide-over sheets. |
| `duration-exit`  | 150ms | `cubic-bezier(0.4, 0, 1, 1)` (ease-in)  | Modal closure, drawer dismissal. |

---

## 3. Standard Animation Patterns

### 3.1 Modal Dialog (`DialogPrimitive.Popup`)
- **Arrival (data-open):**
  ```css
  data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 duration-100
  ```
  Slight 95% scale-up paired with a quick opacity fade ensures the dialog feels snappy and grounded.
- **Departure (data-closed):**
  ```css
  data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100
  ```

### 3.2 Mobile Drawer (`MobileNav`)
- **Arrival:** Translates smoothly from `translateX(-100%)` (LTR) or `translateX(100%)` (RTL) to `0%` over 150ms.
- **Backdrop Overlay:** Fades in from `opacity: 0` to `opacity: 0.1` (`bg-black/10 duration-100`).

---

## 4. Absolute Reduced-Motion Enforcement

Wakeel enforces WCAG 2.2 Level AA reduced-motion compliance via a universal CSS override in `apps/web/src/app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html {
    scroll-behavior: auto !important;
  }
}
```

This guarantees that users with vestibular disorders or visual motion sensitivities experience zero animation or layout movement across the entire platform.
