# Phase 5 — Frontend Architecture

**Status:** Delivered & verified 2026-08-12
**Artifact:** `apps/web` — Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (Base UI) + TanStack Query + RHF/zod + Clerk seam. `next build` clean; runtime smoke verified.

---

## 1. Goal & Definition of Done

**Goal:** the frontend skeleton every later phase plugs into: app structure, data-fetching strategy, design system, auth seam, accessibility and i18n baselines.

**Done when (all verified):**
- [x] `next build` clean (7 routes prerendered/registered, proxy active)
- [x] Landing page (marketing), auth pages, dashboard shell (sidebar/header/nav), cases page (live data path), settings page (form standard)
- [x] Data layer: typed API client (correlation id + JWT injection + response validation), TanStack Query provider
- [x] Same-origin proxy to API verified end-to-end (`/backend/health` → API 200)
- [x] Dark mode (class strategy, system default), skip link, landmarks, aria-current nav
- [x] Urdu content renders with `dir="auto"`/`lang="ur"` (NFR-I18N-01 baseline)

**Deliberately not here:** inbox, calendar, documents, payments, analytics pages — they land with their backend phases (6/11/12/13/14). The overview page marks their data sources instead of rendering fake metrics.

## 2. Key Decisions & Trade-offs

### D-036 — Next.js 16 + Clerk v7 adopted (brief said 15) — flagged, not silent
The brief pins Next 15 but also mandates using current stable recommendations. Next 16.3 is stable (Turbopack default, `proxy.ts` replaces `middleware.ts`, async request APIs mandatory); Clerk v7 moves `clerkMiddleware`/`createRouteMatcher` to `@clerk/nextjs/server` and drops legacy props. Consequence: brief readers should map "middleware" → `proxy.ts`. Rejected: pinning 15 (starts a 2026 enterprise build a major version behind; 15→16 upgrade later is costlier than starting there).

### D-037 — Auth as an env-gated seam (mirrors the backend TenantGuard)
`clerkEnabled = !!NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Off (local dev only): no ClerkProvider, pass-through proxy, dashboard shows a dev banner, API calls carry the dev tenant header (backend guard accepts it in development only). On: ClerkProvider + `proxy.ts` protects `/dashboard/*` via `auth.protect()`. Production always has keys (backend env validation fails fast without them). Rejected: mocking Clerk locally (a fake IdP teaches the wrong integration); committing real test keys (secrets in repo — banned).

### D-038 — Same-origin API access via Next rewrites; no CORS in the trust model
Browser calls `/backend/*` on the web origin; `next.config.ts` rewrites proxy to `API_INTERNAL_URL` (server-only env). Production NGINX repeats the same routing (Phase 15). Rejected: browser-direct cross-origin calls + CORS rules (extra attack surface, preflight latency, credential-mode complexity) — CORS simply never enters the model. The API client's JWT/correlation headers forward through the proxy unchanged.

### D-039 — shadcn/ui current generation (Base UI, not Radix) + provider discipline
The installed shadcn generation composes via Base UI's `render` prop (`<Button render={<Link/>}>`) — no `asChild`. All primitives are local source (`src/components/ui`), so the design system is ours to audit for WCAG. QueryClient is created per-app-instance in state (module-scope clients share cache across users in SSR paths — a real multi-tenant leak class). Rejected: pinning an older shadcn/Radix generation (registry direction is Base UI); a CSS-in-JS design system (Tailwind v4 tokens + CSS variables are the current pattern).

### Data-fetching strategy (stated, per phase scope)
- **Server Components** render shells and static content (landing, overview) — no client JS for what doesn't interact.
- **TanStack Query in client components** for interactive data (cases list now; inbox/calendar later) with `staleTime 30s, retry 1`; mutations invalidate by key.
- **Response validation with zod at the client boundary** (`apiRequest(..., { schema })`) — the frontend treats API responses as untrusted input, matching the backend standard.
- **Server Actions**: deliberately *not* used for API access — they would create a second, shadow API surface to secure and audit; Server Components/Actions are used only where they genuinely help (static rendering now; form actions may be revisited for mutations in later phases — documented exception, not drift).
- Errors surface with **correlation id** (support can join a UI error to backend logs, ADR-005).

## 3. Folder Structure

```
apps/web/src/
├── proxy.ts                        # Next 16 edge hook (Clerk protect when enabled)
├── lib/
│   ├── env.ts                      # zod-validated public env, clerkEnabled seam
│   ├── api-client.ts               # typed fetch: correlation id, JWT, ApiError
│   ├── schemas/case.ts             # response schemas (boundary validation)
│   └── utils.ts                    # cn()
├── components/
│   ├── ui/                         # shadcn primitives (Base UI, local source)
│   ├── providers.tsx               # Theme + Query + Toaster (client)
│   ├── dashboard-nav.tsx           # active-state nav (aria-current)
│   ├── theme-toggle.tsx / user-menu.tsx
└── app/
    ├── layout.tsx                  # fonts, metadata, skip link, Clerk-gated providers
    ├── (marketing)/page.tsx        # landing (RSC) — EN + Urdu (dir=auto)
    ├── (auth)/sign-in|sign-up/…    # Clerk components, seam-aware
    └── (dashboard)/dashboard/
        ├── layout.tsx              # sidebar/header shell, dev banner
        ├── page.tsx                # overview (source-marked placeholders)
        ├── cases/page.tsx          # TanStack Query + zod-validated table
        └── settings/page.tsx       # RHF + zodResolver form standard
```

## 4. Security Considerations

- No secrets in `NEXT_PUBLIC_*` (build-inlined); `API_INTERNAL_URL` is server-only; Clerk keys gate the seam.
- `proxy.ts` protects `/dashboard/*` server-side — client-side nav hiding is never the control.
- API client never stores tokens (Clerk session manages); correlation ids are client-minted UUIDs, charset-validated backend-side.
- QueryClient per instance (no cross-user cache bleed); `retry: 1` bounds mutation replays.

## 5. Accessibility & i18n baseline (NFR-A11Y-01 / NFR-I18N-01)

- Skip-to-content link first focusable; `banner/navigation/main` landmarks; `aria-current="page"`; `role="alert"` on form/load errors; `aria-busy` on skeletons; icon-only buttons labeled; Base UI primitives are keyboard-complete.
- Dark mode via `.dark` class + system default (`suppressHydrationWarning` set correctly).
- Urdu/Nastaliq content: `dir="auto"` + `lang="ur"` on dynamic text containers — the pattern the inbox (Phase 6 UI) will reuse for mixed-script messages.

## 6. Open Questions, Risks & Assumptions

- **OQ-11 (new):** product name "Wakeel" is a placeholder brand — confirm or replace before any Meta display-name submission (display names are painful to change post-verification).
- **Risk:** Clerk v7 is new; its React 19.2/Next 16 compat matrix should be pinned and watched (lockfile committed; upgrades deliberate).
- **Assumption:** Google Fonts (Geist) fetch at build time is acceptable; if build envs must be offline, switch to `next/font/local` (flagged for Phase 15).

## 7. Decision Log Updates

D-036 (Next 16 + Clerk v7), D-037 (env-gated auth seam), D-038 (same-origin proxy, no CORS), D-039 (Base UI shadcn generation + per-instance QueryClient + data-fetching strategy incl. no-Server-Actions-for-API rule) — appended.
