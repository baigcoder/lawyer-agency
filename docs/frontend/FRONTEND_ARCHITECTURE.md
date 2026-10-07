# Wakeel — Frontend Architecture

**Status:** IMPLEMENTED BASELINE & ARCHITECTURAL SPECIFICATION  
**Classification:** Client Architecture, Framework Selection, and Directory Topology  
**Stack Baseline:** Next.js 16.3 (App Router), React 19.2, Tailwind CSS v4, `@base-ui/react`, TanStack Query v5, Clerk v7  

---

## 1. Architectural Overview & Design Decisions

The frontend application (`apps/web`) is structured as a modern, high-performance legal operations dashboard:

```text
┌────────────────────────────────────────────────────────┐
│             BROWSER (CLIENT WORKSTATION)               │
├────────────────────────────────────────────────────────┤
│ • React 19 (Server Components + Client Leaves)         │
│ • TanStack Query v5 (Server State Caching & Polling)   │
│ • React Hook Form + Zod (Strict Boundary Validation)   │
│ • Base UI Primitives (@base-ui/react render prop)      │
│ • Tailwind CSS v4 (OKLCH Custom Properties)            │
└────────────────────────────────────────────────────────┘
                           │
       /backend/* rewrites │ (Same-Origin, No CORS)
                           ▼
┌────────────────────────────────────────────────────────┐
│            NEXT.JS REQUEST EDGE (proxy.ts)             │
├────────────────────────────────────────────────────────┤
│ • Clerk JWT Verification (clerkMiddleware)             │
│ • Dev Seam Header Injection (x-tenant-id, x-user-id)   │
│ • Session Status & Onboarding Redirection              │
└────────────────────────────────────────────────────────┘
                           │
       Internal Proxy Call │
                           ▼
┌────────────────────────────────────────────────────────┐
│             NESTJS MODULAR MONOLITH (API)              │
└────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets (D-036 to D-039)
1. **Same-Origin API Access (D-038):** The browser only talks to same-origin paths (`/backend/*`). Next.js rewrites proxy these requests internally to `API_INTERNAL_URL` (`http://localhost:3001`). This eliminates CORS from the browser security model in development and mirrors production NGINX reverse-proxy configurations.
2. **Base UI Primitives (D-039):** Uses `@base-ui/react` primitives with the `render` prop composition model instead of Radix UI's legacy `asChild` cloning. This provides clean element composition and eliminates React 19 forwardRef warnings.
3. **No Server Actions for API Access:** Server Actions are not used as a shadow API. All frontend data fetching and mutations go through typed, auditable REST endpoints via `apiRequest`.
4. **Zero-Flash Theme Engine (D-104):** Custom `ThemeScript` and `ThemeProvider` use `useSyncExternalStore` over `localStorage`, avoiding React 19 inline script hydration warnings while guaranteeing zero theme flash on page load.

---

## 2. Directory Structure (`apps/web/src/`)

```text
apps/web/src/
├── app/                      # Next.js 16 App Router
│   ├── (auth)/               # Clerk authentication routes (sign-in, sign-up, reset-password)
│   ├── (dashboard)/          # Dashboard operational workspace
│   │   └── dashboard/        # Subpages: overview, inbox, cases, calendar, etc.
│   ├── (marketing)/          # Landing page and demo walkthrough
│   ├── onboarding/           # 4-step firm setup wizard
│   ├── terms/, privacy/      # Public legal compliance pages
│   ├── globals.css           # OKLCH tokens, Nastaliq typography, WhatsApp tokens
│   ├── layout.tsx            # Root layout with fonts, skip link, ClerkProvider
│   └── proxy.ts              # Next.js 16 edge request hook (successor to middleware.ts)
├── components/               # React component library
│   ├── ui/                   # Base UI primitives (button, dialog, select, table, etc.)
│   ├── inbox/                # Priority Inbox subsystem (chat, voice notes, formatting)
│   ├── overview/             # Dashboard command center widgets
│   ├── escalations/          # Safety triage and handoff brief components
│   └── *.tsx                 # Domain components (page-header, metric-card, nav, etc.)
└── lib/                      # Core utilities and business logic
    ├── api-client.ts         # Typed fetch wrapper with correlation ID and Zod validation
    ├── dashboard-nav.ts      # Navigation menu items, section groups, permissions
    ├── env.ts                # Zod-validated frontend environment variables
    ├── format.ts             # Currency formatting (PKR), timeAgo, name initials
    ├── language.tsx          # Bilingual language context provider (EN/UR)
    ├── permissions.ts        # Local RBAC permission verification helpers
    ├── schemas/              # Zod schemas matching backend API contracts
    ├── session.tsx           # Session context and role resolution
    └── translations.ts       # Complete English / Urdu translation dictionaries (76KB)
```
