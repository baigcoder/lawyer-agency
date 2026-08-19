# Phase 16 — Two-Stage Connection & Operations Build-out (Post-MVP)

Status: **in progress** — Phase 1 (onboarding), Phase 4-urgent (model swap → `openai/gpt-oss-20b`), Phase 2 (pilot bridge), Phase 3 (official `connectionStage` state machine), Phase 5 (firm ops), and the Sprint 1 connection enhancements all delivered. Next: Sprint 2 (pilot resilience), Sprint 3 (official adoption depth), Sprint 4 (pilot media download).

## Problem

The product promised "WhatsApp connection" as a single Meta Embedded Signup flow (D-002), but:
- Meta's production path is heavy (Business Verification, Tech Provider approval, USD billing) and blocks fast product validation with a firm's own phone number.
- The paid Twilio seam was never wired into the message path and adds cost for zero value.
- The model catalog default (`groq/llama-3.3-70b-versatile`) is deprecated on 2026-08-16.
- Firm onboarding existed but was minimal (name + location) and settings were saved locally in the browser.
- Several production gaps: no backups, no Sentry wiring, no staging smoke tests, `/dashboard/analytics` is a 404 nav link, media is filesystem-only.

## Solution: 7 workstreams (all approved, build in order)

| # | Workstream | Deliverables | Decisions |
|---|---|---|---|
| P1 | Onboarding foundation | Full firm wizard (practice areas, languages, hours, team, admin), idempotent provisioning API, provisioning guard, settings persisted to API, landing walkthrough | D-093 |
| P2 | Pilot connection | Baileys QR bridge in worker role: `PilotSession` table, encrypted per-tenant session, allowlist-only, auto-expiry, no terminal/fs/tools surface; `OutboundSender` seam (Meta + pilot adapters); pilot API + UI; **remove Twilio entirely** | D-092 |
| P3 | Official state machine | `WhatsappAccount.connectionStage` (OFFICIAL_CONNECT_STARTED → META_PENDING_VERIFICATION → NUMBER_VERIFIED → TEMPLATES_PENDING → READY_TO_GO_LIVE → LIVE → PAUSED/REJECTED/DISCONNECTED), go-live checklist, `/v1/whatsapp/health` with webhook health, disconnect flow | D-092 |
| P4 | Agent control plane | Groq adapter + `GROQ_API_KEY`/`GROQ_BASE_URL`, model pass-through on `AiCallOptions` (router-chosen model must reach the wire), retries/429/circuit breaker/fallback, **default model `groq/openai/gpt-oss-20b`**, KB/escalations dashboard pages, `scripts/evaluate-agents.ts` + refusal specs | (pending D-094) |
| P5 | Firm ops | `/dashboard/analytics` page, overview banner, team availability, doc requests, `PaymentRail` factory with legal gate | (pending D-095) |
| P6 | Production hardening | backup script, Sentry wiring, staging compose + smoke test, Supabase storage adapter, red-team specs | (pending D-096) |
| P7 | Voice | deferred — docs only | — |

## Phase 1 — Onboarding foundation (delivered)

### Backend
- `apps/api/src/modules/firm-profile/application/dto.ts`:
  - `firmProfileSchema` extended: `displayName`, `officeAddress` (optional), `website` (URL or empty), `teamSize` (1–5000) added alongside firmName/city/practiceAreas/clientLanguages/officeHours.
  - `provisionFirmSchema` = full wizard: `firmName` required; everything else optional (defaults server-side).
- `firm-provisioning.service.ts` (idempotent):
  - `provision(input)`: create tenant on first call; on subsequent calls **merge only supplied keys** into `Tenant.settings` (fixed a bug where defaults clobbered stored values).
  - `wizardSettings()`: server-side defaults — `displayName` = firmName, `officeHours` = "Mon–Sat, 9:00–18:00 PKT", `clientLanguages` = [EN, UR, ROMAN_URDU], `teamSize` = 1.
  - `status(clerkOrgId)` → `{ provisioned, tenantId }` for the guard.
- `firm-provisioning.controller.ts`: `requireIdentity` helper (returns verified claims + `clerkOrgId`), `PUT /v1/firm-provisioning`, new `GET /v1/firm-provisioning/status`.
- `firm-profile.service.ts`: reads/writes new fields with defaults.
- Spec `firm-profile.service.spec.ts`: **5/5 passing** (profile read w/ defaults, full persist, tenant create w/ admin, idempotent merge preserving stored values, status by org).

### Web
- `apps/web/src/lib/schemas/firm-profile.ts`: rewritten schema + `practiceAreaOptions` const (Family Law, Property, Criminal Defence, Corporate, Immigration, Family Violence, Other).
- `/onboarding`: 4-step wizard — (1) firm details, (2) practice areas picker, (3) languages + office hours, (4) admin + review; step-gated validation via `form.trigger`; submits full payload to `PUT /v1/firm-provisioning`, then navigates to `/dashboard/setup`.
- `provisioning-guard.tsx` (client): zod-validates `GET /v1/firm-provisioning/status`; enabled only when Clerk present and loaded; redirects unprovisioned orgs to `/onboarding`; spinner/error states; mounted in `dashboard/layout.tsx`.
- `/dashboard/setup`: new fields (display name, address, website, team size) + defaults.
- `/dashboard/settings`: `FirmSettingsCard` now GET/PUTs `/v1/firm-profile` (previously saved locally); success toast "Changes are live"; `consultationFeePkr` stays local (stripped before PUT).
- `/dashboard` (landing): 4 walkthrough cards (setup → connect → AI answers → payments) + "How connection works" banner explaining Pilot vs Official modes.

### Verification (Phase 1)
- API: `tsc -p tsconfig.build.json --noEmit` clean; `vitest run src/modules/firm-profile` 5/5.
- Web: `tsc --noEmit` clean; eslint 0 errors on all touched files.
- E2E (minted Clerk token, tenant `ca2849ac-c102-4ca3-a7ec-092fd08063a5`): `GET /v1/firm-provisioning/status` → provisioned; `PUT /v1/firm-provisioning` full wizard payload → profile reflects all 10 fields; partial PUT (firmName + teamSize only) → merge preserves officeHours/website/practiceAreas.
- Pages compile and serve (auth-gated 307 to Clerk sign-in for unauthenticated curl is expected).

### Type-fix notes (web)
- zod `.optional().default('')` makes resolver input type ≠ output type → React Hook Form type error. Removed `.default()` (server supplies defaults) so input = output.
- Base UI components use `render` prop, not `asChild` (AGENTS.md rule).
- `react-hooks/incompatible-library` (React Compiler) flags `form.watch()` in render → use `useWatch` (unconditionally, top of component) or `Controller`.

## Phase 3 — Official connection state machine (delivered 2026-08-17)

- Migration `0015_whatsapp_connection_stage`: `app.ConnectionStage` enum + `whatsapp_accounts.connectionStage` (default `OFFICIAL_CONNECT_STARTED`).
- `OnboardingService` (D-092 state machine):
  - `complete()` → account lands `NUMBER_VERIFIED`, seeds templates, then advances to `TEMPLATES_PENDING` (0 approved) or `READY_TO_GO_LIVE` (≥1 approved); never downgrades LIVE/PAUSED/DISCONNECTED on template re-sync.
  - `goLive(tenantId)` — explicit admin gate: 404 without an account, 409 unless stage is `READY_TO_GO_LIVE` + Meta-verified + ≥1 APPROVED template; flips `LIVE`.
  - `disconnect(tenantId)` — 404 without an account; clears `accessTokenEnc` (sends stop) and marks `DISCONNECTED`.
  - `health(tenantId)` — stage + `webhookConfigured` (META_APP_ID + verify token present) + go-live checklist + template counts.
- `WhatsappConnectionController` (`/v1/whatsapp`): `GET /health`, `POST /go-live`, `POST /disconnect` (same `whatsapp:manage` guard stack).
- `connectionStatus` now returns `connectionStage`; repo port gained `updateConnectionStage`.
- Web: `connectionStageSchema` + health/mutation schemas; official card shows a stage badge + stage copy, a **Go live** button (READY_TO_GO_LIVE only) and **Disconnect**.
- Verified live (dev seam): health checklist, READY→LIVE (201), LIVE→go-live again (409), disconnect→DISCONNECTED, status reflects each stage. Onboarding spec 11/11; suite 123/123.

## Phase 4 — Agent control plane (model swap delivered; rest pre-existing)

- Urgent: `groq/llama-3.3-70b-versatile` → `openai/gpt-oss-20b` (deprecation 2026-08-16); `AI_DEFAULT_MODEL` env default, CATALOG alias, and `model` on `AiCallOptions` threaded to all 5 agents; live Groq call verified (D-094).
- Remaining P4 items (KB/escalations dashboard pages, `scripts/evaluate-agents.ts`) are backlog.

## Phase 2 — Pilot connection (delivered 2026-08-15)

Design intent (detail in Phase 2 doc when built):
- `@whiskeysockets/baileys` in `apps/api` worker role only.
- `PilotSession` model: `tenantId` unique, `status` (PAIRING/PAIRED/EXPIRED/DISCONNECTED), `allowlist` JSON of phone numbers, `sessionCredsEnc` AES-256-GCM, `expiresAt`, `lastSeenAt`; QR key in Redis with TTL.
- `PilotBridgeService` (worker): socket lifecycle, QR event → Redis key → API polls, `messages.upsert` → `NormalizedInboundMessage` → `WHATSAPP_INBOUND` queue (job id `pilot-${key}`), allowlist gate on inbound, NO terminal/fs/tools in v1 (session creds in DB, QR via API only).
- `OutboundSender` port: `MetaCloudSender` (existing) + `PilotSender` (bridge); `send.service.ts` picks by account mode.
- Env: `PILOT_BRIDGE_ENABLED` (superRefine: production must be false), `PILOT_SESSION_TTL_HOURS`, `PILOT_MAX_ALLOWLIST`.
- API: `POST /v1/whatsapp/pilot/pair`, `GET /v1/whatsapp/pilot/qr`, `GET /v1/whatsapp/pilot/status`, `POST /v1/whatsapp/pilot/disconnect`.
- Remove: Twilio controller/ingest/client, `scripts/seed-twilio-sandbox.js`, TWILIO_* envs.
- UI: whatsapp page becomes two cards (Pilot QR + Official embedded signup).

## Environment notes
- Dev API runs via `nohup npx nest start --watch > /tmp/opencode/api-dev.log` from `apps/api` (port 3001); web on 3002 (`/tmp/opencode/web-dev.log`).
- Clerk Instance A keys in `apps/web/.env.local`; token minting via `POST https://api.clerk.com/v1/sessions/sess_3Hvfay4ZDO6BChWT8roebxskeq6/tokens` (form-urlencoded `organization_id=org_3HvfhP7ekoWygejP75TMryOTojY`).
- Groq deprecation: `groq/llama-3.3-70b-versatile` retired 2026-08-16 → default becomes `groq/openai/gpt-oss-20b`.
