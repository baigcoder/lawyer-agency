# Wakeel — State Management Architecture

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** State Architecture, Cache Strategies, and Store Topologies  
**Core Technologies:** TanStack Query v5, React 19 `useSyncExternalStore`, React Hook Form  

---

## 1. State Classification & Storage Matrix

Wakeel categorizes application state into five strict tiers, avoiding monolithic global stores (e.g. Redux or Zustand) where native React primitives and TanStack Query suffice:

| State Tier | Technology / Mechanism | Persistence Target | Typical Usage |
|---|---|---|---|
| **1. Server State** | TanStack Query v5 (`useQuery`, `useMutation`) | In-memory cache + query deduplication | Inbox messages, cases, payments, calendar appointments, metrics. |
| **2. URL / Route State** | Next.js App Router (`useSearchParams`, `usePathname`) | Browser URL query strings | Status filters (`?status=OPEN`), active tabs, selected matter IDs. |
| **3. Client Context State**| React Context + `useSyncExternalStore` | `localStorage` + document root | Active language (`en` vs `ur`), theme mode (`dark` vs `light`), auth session. |
| **4. Form State** | React Hook Form (`useForm`, `Controller`) | Component-scoped ref memory | In-flight form edits, validation errors, dirty field tracking. |
| **5. Ephemeral UI State** | React `useState` | Component instance memory | Modal open/close state, mobile drawer toggle, active hover tooltips. |

---

## 2. Server State with TanStack Query v5

### 2.1 Cache Key Conventions
Query keys follow hierarchical tuple structures:
- `['inbox', 'list']` — Top-level conversation queue.
- `['inbox', 'detail', id]` — Individual conversation thread.
- `['cases', filter]` — Case ledger filtered by status.
- `['appointments', { from, to }]` — Calendar date window.

### 2.2 Polling & Invalidation Disciplines
- **Priority Inbox & Escalations:** Polled every 5,000ms (`refetchInterval: 5000`) to guarantee fast notification of inbound client messages.
- **Atomic Cache Invalidation:** Mutations (e.g. `transitionCase`, `resolveEscalation`, `sendMessage`) explicitly call `queryClient.invalidateQueries({ queryKey: [...] })` inside their `onSuccess` handlers.

---

## 3. Client Storage via `useSyncExternalStore`

Both the Theme and Language providers leverage React 19's `useSyncExternalStore`:
- **Why?** Eliminates React hydration mismatches between server-rendered HTML and client `localStorage`.
- **Cross-Tab Sync:** Listens to `window.addEventListener('storage')`, ensuring that changing the language or theme in one browser tab updates all other open Wakeel tabs instantly.
