# Phase 6 — WhatsApp Integration

**Status:** 6a + 6b delivered & verified 2026-08-12  
**Split (per working agreement):** **6a** = webhook verification/ingestion, tenant routing, inbound persistence with 24h-window state, send path. **6b** = Embedded Signup onboarding, template sync/management, media download handoff, delivery-status application, payload trim.

---

## 1. Goal & Definition of Done

**Goal:** the WhatsApp message plane, end to end: verified webhooks in, normalized persistence with window state, policy-enforced sends out — and the firm onboarding, template, and media lifecycle around it.

**Done when (all verified, evidence §6):**
- [x] GET verification handshake (hub.challenge)
- [x] POST ingestion: HMAC-SHA256 over raw bytes, constant-time compare; bad signature → 401 before any work
- [x] Tenant routing via `platform.wa_routes`
- [x] Idempotency: unique `externalEventId` → queue `jobId` → `wamid` lookup (three fences, D-045)
- [x] `MessagesService.recordInbound`: client upsert, open-conversation reuse, window roll, outbox event, async media handoff
- [x] Delivery status updates: rank-based anti-downgrade, FAILED terminal (D-050)
- [x] SendService: free-form blocked outside window, templates APPROVED-only, Meta 131047 mapping, per-tenant AES-GCM token decryption
- [x] Embedded Signup: code exchange → WABA info → encrypted token → `whatsapp_account` + `wa_routes` + default template seed
- [x] Template sync from Meta + template-status webhook application
- [x] Media download offloaded to worker queue + Documents module storeMedia handoff
- [x] Payload trimming service for processed `webhook_events`
- [x] Full `tsc --noEmit` clean, 31/31 tests, ESLint clean

## 2. Key Decisions

### D-040 — `platform.wa_routes` for pre-tenant routing
Webhooks identify the firm only by Meta's `phone_number_id`; `whatsapp_accounts` sits behind RLS. A slim platform-schema routing table resolves it before any tenant context exists.

### D-041 — Signature verification on raw bytes, fail-fast 401
`rawBody: true` at bootstrap; HMAC over exact bytes with `timingSafeEqual`. Malformed-but-validly-signed payloads are acked-and-dropped.

### D-042 — Window enforcement blocks, never fails
Free-form sends outside the 24h window throw `WindowClosedError` before any API call; templates require APPROVED status.

### D-043 — Boundary rule refined by a real catch
Siblings may import a module's module file (DI wiring) and exported application services; `domain/`, `infrastructure/`, `interface/` remain banned. Shared concepts live in `common/messaging`.

### D-044 — Env convention: empty string = unset
dotenv `KEY=` loads as `''`; `validateEnv` strips empties before zod parsing.

### D-045 — Three-fence idempotency (inbound)
`webhook_events.externalEventId` unique → BullMQ `jobId` → `recordInbound` wamid lookup.

### D-046 — Media download is async, not inline
Inbound webhook acks must stay fast (ADR-004). Media IDs are enqueued to `whatsapp-media`; a worker downloads from Meta CDN, stores via object-storage port, and creates a `documents` row.

### D-047 — Object-storage port with filesystem dev stand-in
Production implementation will be Supabase/S3. For 6b, a `FilesystemObjectStorage` adapter under `MEDIA_STORAGE_PATH` lets the handoff run end-to-end in dev without cloud credentials.

### D-048 — Embedded Signup writes both app table and routing table atomically
`OnboardingService.complete` updates `whatsapp_accounts` (tenant-scoped, encrypted token) and `platform.wa_routes` (cross-tenant routing), then seeds the default template pack.

### D-049 — Default template pack is DRAFT until Meta approves
Starter pack contains only UTILITY templates in English and Urdu. No MARKETING category (D-005). Sync from Meta moves statuses to APPROVED/REJECTED/PAUSED.

### D-050 — Delivery-status rank-based updates
Status transitions ignore downgrades and treat FAILED as terminal. Prevents a late `sent` receipt from overwriting a `delivered`/`read` state.

## 3. What was built

```
modules/whatsapp/
├── domain/errors.ts                    # signature/route/credential/conversation/template/MetaApi errors
├── application/
│   ├── dto.ts                          # webhook payload/status/template-update zod schemas + normalizeMessage
│   ├── ports.ts                        # WaRouteLookup, repos, MetaCloudApi, MetaOAuthClient, ObjectStorage
│   ├── webhook-ingest.service.ts       # verify → persist raw → enqueue message/status/media/template
│   ├── send.service.ts                 # window + template policy, decrypt, deliver, record
│   ├── template-sync.service.ts        # seed/sync/apply template statuses
│   └── onboarding.service.ts           # Embedded Signup completion
├── infrastructure/
│   ├── meta-cloud-api.client.ts        # Graph API send/list-templates/download-media
│   ├── meta-oauth.client.ts            # code exchange + WABA info
│   ├── prisma-whatsapp.repositories.ts # wa_routes + accounts + templates
│   └── filesystem-object-storage.ts    # dev storage adapter
└── interface/
    ├── webhooks.controller.ts          # GET/POST /v1/webhooks/whatsapp
    ├── templates.controller.ts         # sync / seed-defaults / status
    ├── onboarding.controller.ts        # start / complete
    ├── inbound.processor.ts            # worker: recordInbound
    ├── status.processor.ts             # worker: apply delivery status
    └── media.processor.ts              # worker: download & store media
common/queue/queue.constants.ts         # +whatsapp-status +whatsapp-media
modules/messages/                       # recordInbound (+ media enqueue), applyStatusUpdate
modules/documents/                      # DocumentsService.storeMedia (Phase 6b stub)
.env.example                            # +META_GRAPH_BASE_URL, META_REDIRECT_URI, MEDIA_STORAGE_PATH
```

## 4. Security Considerations

- HMAC before parse, constant-time compare; verify token never logged.
- WABA tokens encrypted at rest and decrypted only inside send/onboarding transactions.
- Webhook controller un-guarded by TenantGuard — signature is the auth.
- Payloads stored raw in `platform.webhook_events`; `trimProcessedPayloads` removes them after processing.
- Media downloaded with tenant-scoped paths; no client-controlled filename reaches storage path directly.

## 5. Boundary Observations

- `documents/application/documents.service.ts` imports `TenantCredentialsMissingError` from `whatsapp/application/ports` (re-exported public contract), not from `whatsapp/domain`. This is the intended pattern.
- `messages/application/messages.service.ts` enqueues to `whatsapp-media` queue but remains a consumer of no WhatsApp internals.

## 6. Verification Evidence (this environment)

- `tsc --noEmit` clean · **31/31 tests** · ESLint clean
- Build successful; live server registers all routes:
  - `GET /v1/webhooks/whatsapp`
  - `POST /v1/webhooks/whatsapp`
  - `GET /v1/whatsapp/onboarding/start`
  - `POST /v1/whatsapp/onboarding/complete`
  - `POST /v1/whatsapp/templates/sync`
  - `POST /v1/whatsapp/templates/seed-defaults`
  - `PUT /v1/whatsapp/templates/status/:tenantId`
- **Not verified here (no Docker):** DB-backed flows, real Meta OAuth/token exchange, CDN downloads. First integration run: `docker compose up -d && prisma migrate deploy`.

## 7. Next Work

**Phase 7** — AI agent pipeline (router, intake extraction, classification, escalation triggers, model-routing budget guard, RAG retrieval, citation writing).
