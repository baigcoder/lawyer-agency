# Phase 13 — Payments

**Goal:** Implement payment request/recording for law firms: electronic rails (JazzCash, Easypaisa, local/international cards) and manual/offline recording, with webhook reconciliation and outbox events.

## What was built

### Backend (`apps/api`)

1. **Domain events**
   - Added `payment.requested`, `payment.succeeded`, `payment.failed`, `payment.refunded` to the registry with validated T1/T2 payloads.

2. **Payment rail port** (`modules/payments/application/ports.ts`)
   - `PaymentRail` interface: `initiate(request)` returns redirect URL/providerTxnId; `parseWebhook(payload)` returns normalized status.
   - Keeps provider specifics out of the application service.

3. **Stub electronic rail** (`modules/payments/infrastructure/stub-rail.adapter.ts`)
   - Simulates a redirect flow and a simple webhook payload so the lifecycle can be tested without live provider credentials.

4. **Payments service** (`modules/payments/application/payments.service.ts`)
   - `requestPayment`: creates payment row, publishes `payment.requested`, calls rail adapter.
   - `recordManualPayment`: synchronous recording for `BANK_TRANSFER`/`CASH`/`OTHER_MANUAL` with staff attribution.
   - `processWebhook`: idempotent reconciliation by `providerTxnId`.
   - `refund`: marks succeeded/manual payments as refunded.
   - `list`/`getById`: tenant-scoped reads.

5. **Payments controller** (`/v1/payments`)
   - `POST /v1/payments` — request electronic payment.
   - `POST /v1/payments/manual` — record manual receipt.
   - `POST /v1/payments/webhooks/:method` — provider webhook ingress.
   - `GET /v1/payments` — list with case/client/status filters.
   - `POST /v1/payments/:id/refund` — refund.
   - Protected by AuthGuard/PermissionGuard (`payments:read/write/refund`).

6. **Schema**
   - Added `Payment.recordedByUser` relation.
   - Prisma client regenerated.

### Frontend (`apps/web`)

1. **Payments page** (`/dashboard/payments`)
   - Form to request electronic payments or record manual/offline receipts.
   - Payment history table with status badges and refund action.
   - Zod schema in `src/lib/schemas/payment.ts`.

## Decisions (D-080…D-082)

- **D-080:** Payments via `PaymentRail` port; integer money in minor units; `providerTxnId` webhook idempotency.
- **D-081:** Electronic rails return redirect URLs; manual rails record synchronously; all transitions publish outbox events.
- **D-082:** Dev/staging uses a single stub electronic rail; production registers provider-specific adapters without service changes.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx vitest run` — **23 test files, 81 tests pass**.
- `npx eslint "src/**/*.ts"` — clean.
- `npm run build` — API and web both build.

## Next

- Phase 14 (analytics CQRS read models) or Phase 15 (deploy/ops).
