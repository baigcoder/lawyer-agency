# Wakeel — Frontend Performance Plan

**Status:** IMPLEMENTED BASELINE & PERFORMANCE PLAN  
**Classification:** Core Web Vitals, Bundle Optimization, and Query Performance  
**Target Metrics:** LCP < 1.8s, INP < 100ms, CLS = 0 on 3G/4G Pakistani Mobile Connections  

---

## 1. Core Web Vitals Budget & Target Metrics

| Metric | Target Standard | Current Baseline | Strategy to Maintain |
|---|:---:|:---:|---|
| **Largest Contentful Paint (LCP)** | `< 1.8s` | ~1.4s | Server component shells, self-hosted Next.js Google fonts, SVG brand assets. |
| **Interaction to Next Paint (INP)** | `< 100ms` | ~45ms | Lightweight Base UI primitives, zero heavy animation loops, RHF controlled inputs. |
| **Cumulative Layout Shift (CLS)** | `0.00` | 0.00 | Strict skeleton parity, locked `h-svh` inbox viewport, fixed font line-heights. |
| **First Input Delay (FID)** | `< 50ms` | ~20ms | Minimal third-party JavaScript; zero client marketing trackers inside dashboard. |

---

## 2. Bundle Optimization & Code Splitting

1. **Next.js Standalone Packaging:** `next.config.ts` outputs `standalone`, eliminating unnecessary build dependencies from production Docker images.
2. **Icon Tree Shaking:** `lucide-react` icons are imported as named symbols, allowing ES build treeshaking to drop unused glyphs.
3. **No Heavy Visualization Bloat:** Custom lightweight CSS bar charts (`analytics/page.tsx`) replace multi-megabyte charting libraries (e.g. Recharts or Chart.js).
4. **Zero Client Font Shifts:** `next/font/google` downloads and self-hosts Inter, Geist Mono, and Noto Nastaliq Urdu at build time, eliminating external Google CDN network hops.

---

## 3. Network & Query Optimization

- **Stale-While-Revalidate:** TanStack Query caches data in memory, presenting instant UI upon tab switching while refreshing data in the background.
- **Window Focus Throttling:** `refetchOnWindowFocus: false` on static lists (e.g. Team Roster, Firm Profile) prevents unnecessary API fetches.
- **Polling Intervals:** Restricted to active triage surfaces: Priority Inbox (`5,000ms`) and Escalations Queue (`5,000ms`).
