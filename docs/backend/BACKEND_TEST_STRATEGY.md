# Wakeel — Backend Test Strategy & Test Suite Roster

**Status:** IMPLEMENTED BASELINE & VERIFICATION SPECIFICATION  
**Classification:** Backend Test Suites, Vitest Configuration, and Safety Coverage  
**Current Test Run:** **86 Tests Passing across 11 Test Suites (100% Pass Rate)**  
**Command:** `cd apps/api && npx vitest run`  

---

## 1. Test Suite Architecture

Backend tests are authored using **Vitest** for instant execution and native ESM support:

```text
               ┌───────────────────────┐
               │  Safety Red-Team      │  100% Recall Gate (Regex Scanners)
               ├───────────────────────┤
               │  Unit Services        │  SlotFinder, Language, Token Counters
               ├───────────────────────┤
               │  UoW & RLS Tests      │  UnitOfWork.withTenant & Fail-Closed
               ├───────────────────────┤
               │  Zod Validation Pipes │  Boundary DTO Ingestion
               └───────────────────────┘
```

---

## 2. Test Suites Roster (`apps/api/src/**/*.spec.ts`)

| Test File | Component Under Test | Test Count | Key Invariants Verified |
|---|---|:---:|---|
| `escalation-detector.service.spec.ts` | Safety Keyword Scanner | 14 | Domestic violence, arrest, suicide, and deadline regex recall across EN, UR, and Roman Urdu. |
| `slot-finder.service.spec.ts` | Consultation Slot Finder | 10 | Holiday exclusions, lawyer availability boundaries, and overlapping appointment avoidance. |
| `reply-language.spec.ts` | Language Classifier | 8 | Automatic detection of English, Urdu Nastaliq, and Roman Urdu transliterations. |
| `unit-of-work.spec.ts` | Tenancy Isolation Engine | 8 | GUC setting (`app.tenant_id`), transaction rollback on exception, fail-closed queries. |
| `outbox-writer.spec.ts` | Transactional Outbox | 6 | Atomic event appending inside database transaction; schema validation before append. |
| `evolution-webhook-ingest.spec.ts` | Webhook Deduplication | 8 | Three-fence idempotency: duplicate external event drops, HMAC validation. |
| `voice-reply.service.spec.ts` | Voice Note Pipeline | 6 | Whisper STT transcript extraction and ElevenLabs TTS audio fallbacks. |
| `payment-receipt.handler.spec.ts` | Fee Collection & Receipts | 6 | Receipt generation, PDF attachment delivery, appointment auto-confirmation. |
| `auth.guard.spec.ts` | Authentication & Dev Seam | 8 | Clerk JWKS token validation and dev tenant header fallbacks. |
| `permission.guard.spec.ts` | Local RBAC Engine | 6 | Permission checking, wildcard matching, OR-condition evaluations. |
| `case-auto-create.handler.spec.ts` | Lead Qualification | 6 | Auto-creation of `app.cases` when intake agent extracts qualified matter facts. |

---

## 3. Mandatory CI Verification Gates

Prior to merging any pull request affecting backend logic:
```bash
# 1. Typecheck the entire backend project
cd apps/api && npx tsc -p tsconfig.build.json --noEmit

# 2. Run backend linter including hexagonal boundary rules
npx eslint "src/**/*.ts"

# 3. Execute all unit and safety test suites
npx vitest run
```
All three commands must return 0 errors.
