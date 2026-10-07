# Database Migrations Log — Forensic Catalog (0001–0030)

This document provides a forensic audit and reference manual for all 30 database migrations residing in `apps/api/prisma/migrations/`. Every migration is executed linearly during startup via the Docker `migrate` container using `prisma migrate deploy` connected as the privileged database owner (`MIGRATION_DATABASE_URL`).

---

## 1. Migration Inventory & Chronology

| Seq | Migration Name | Applied In | Core Purpose & Architectural Impact | Key Decision Log |
| :--- | :--- | :--- | :--- | :--- |
| **0001** | `0001_init` | Phase 3 | Baseline relational schema for `platform` and `app` schemas. | [D-001](file:///f:/lawyer_agency/docs/decision-log.md), [D-002](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0002** | `0002_rls_and_constraints` | Phase 3 | PostgreSQL `FORCE RLS`, `app_user` role, appointment GIST exclusion, audit append-only revoke. | [D-001](file:///f:/lawyer_agency/docs/decision-log.md), [D-002](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0003** | `0003_partitions_and_vector` | Phase 3 | RANGE partitioning on `messages`, `audit_logs`, `ai_logs`; HNSW index on `kb_chunks`. | [D-003](file:///f:/lawyer_agency/docs/decision-log.md), [D-005](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0004** | `0004_wa_routes` | Phase 4 | Pre-RLS routing table mapping `phoneNumberId` to `tenantId`. | [D-040](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0005** | `0005_intake_session_unique` | Phase 4 | Unique constraint on `(tenantId, conversationId)` in `intake_sessions`. | [D-004](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0006** | `0006_tenant_clerk_org` | Phase 5 | `clerkOrgId` mapping column added to `platform.tenants`. | [D-017](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0007** | `0007_conversation_assignment` | Phase 5 | Added `assignedToId` FK on `app.conversations` with RLS index. | [D-048](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0008** | `0008_notification_channels` | Phase 5 | Multi-channel delivery enum (`DASHBOARD`, `WEB_PUSH`, `WHATSAPP_TEMPLATE`, `EMAIL_DIGEST`). | [D-055](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0009** | `0009_analytics_daily` | Phase 5 | Added `platform.analytics_daily` table for firm operational rollups. | [D-060](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0010** | `0010_analytics_daily_rls` | Phase 5 | Enforced RLS policy on `analytics_daily` so tenants view only their metrics. | [D-001](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0011** | `0011_analytics_daily_write_perms` | Phase 5 | DML permissions for `app_user` on `analytics_daily`. | [D-060](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0012** | `0012_analytics_daily_rls_write` | Phase 5 | Added `WITH CHECK` expression on `analytics_daily` RLS policy. | [D-001](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0013** | `0013_platform_tenant_self_service` | Phase 6 | Permitted `app_user` to update self tenant metadata settings. | [D-072](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0014** | `0014_pilot_sessions` | Phase 6 | Added `app.pilot_sessions` table for Baileys QR pilot testing. | [D-092](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0015** | `0015_whatsapp_connection_stage` | Phase 6 | Added `connectionStage` enum to track official WABA onboarding steps. | [D-092](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0016** | `0016_wa_routes_delete_grant` | Phase 6 | Granted `DELETE` on `platform.wa_routes` to `app_user` for unlinking numbers. | [D-040](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0017** | `0017_pilot_session_last_error` | Phase 6 | Added `lastError` and `lastErrorAt` diagnostic columns to `pilot_sessions`. | [D-092](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0018** | `0018_tenant_features` | Phase 7 | Added `platform.tenant_features` table to gate official WhatsApp API. | [D-095](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0019** | `0019_evolution_whatsapp_connection` | Phase 7 | Added `app.whatsapp_connections` table to track Evolution API instance status. | [D-106](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0020** | `0020_document_chunks_and_pinned` | Phase 8 | Added `document_chunks` table and `isPinned` flag on `app.documents`. | [D-108](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0021** | `0021_lawyer_calendars` | Phase 9 | Added `app.lawyer_calendars` table for Google Calendar OAuth sync. | [D-109](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0022** | `0022_lawyer_profile_highlights` | Phase 9 | Added `lawyer_case_highlights` table and Bar Council profile fields. | [D-110](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0023** | `0023_roadmap_features` | Phase 10 | Added `court_hearings` (court diary) and `conversation_notes` tables. | [D-118](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0024** | `0024_payment_proof_receipt` | Phase 10 | Added `PAYMENT_PROOF` and `RECEIPT` document types to `DocType` enum. | [D-119](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0025** | `0025_escalation_handoff_brief` | Phase 11 | Added `handoffBrief jsonb` column to `app.escalations`. | [D-123](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0026** | `0026_voice_calls` | Phase 12 | Added `app.voice_calls` table and enums for AI Receptionist call logs. | [D-124](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0027** | `0027_document_chunks_vector_index`| Phase 13 | Added HNSW index on `document_chunks.embedding` (`m=16, ef_construction=64`). | [D-108](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0028** | `0028_null_zero_vector_embeddings` | Phase 13 | Cleaned legacy zero vectors to NULL prior to re-indexing. | [D-108](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0029** | `0029_local_embeddings_384` | Phase 14 | Migrated embeddings from 1536 to 384 dimensions (`multilingual-e5-small`). | [D-005](file:///f:/lawyer_agency/docs/decision-log.md), [D-125](file:///f:/lawyer_agency/docs/decision-log.md) |
| **0030** | `0030_ai_logs_queued_ms` | Phase 15 | Added `queuedMs` column to `app.ai_logs` for queue wait telemetry. | [D-005](file:///f:/lawyer_agency/docs/decision-log.md) |

---

## 2. In-Depth Technical Walkthrough of Critical Migrations

### 2.1 `0002_rls_and_constraints`: The Tenant Isolation Fortress
- **Non-Privileged Application Role:** Provisions `app_user` with `NOBYPASSRLS`.
- **Dynamic Policy Injection:** Executes PL/pgSQL block iterating over all 24 initial app-schema tables:
  ```sql
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON app.%I USING (%s) WITH CHECK (%s)', t, policy_expr, policy_expr);
  ```
- **Append-Only Tamper-Proofing:** Revokes `UPDATE, DELETE ON app.audit_logs FROM app_user`.
- **GIST Exclusion Constraint:** Prevents double-booking appointments per advocate across overlapping time intervals:
  ```sql
  ALTER TABLE app.appointments
    ADD CONSTRAINT no_double_booking
    EXCLUDE USING gist (
      "lawyerId" WITH =,
      tstzrange("startsAt", "endsAt", '[)') WITH &&
    )
    WHERE (status IN ('PENDING', 'CONFIRMED'));
  ```

### 2.2 `0003_partitions_and_vector`: Horizontal Scalability
- **Conversion to RANGE Partitioning:** Unbounded tables (`messages`, `audit_logs`, `ai_logs`) are swapped with partitioned parent tables keyed by `("createdAt")`.
- **Composite Primary Keys:** Updates primary keys from `(id)` to `(id, "createdAt")` to satisfy PostgreSQL partitioning invariants.
- **Initial Partition Set:** Pre-creates 6 monthly partitions plus a `DEFAULT` catch-all safety partition.
- **pgvector Cosine Index:** Establishes HNSW index on `kb_chunks(embedding vector_cosine_ops)` with `m = 16, ef_construction = 64`.

### 2.3 `0029_local_embeddings_384`: Sovereign Local AI Embeddings
- **Rationale:** Third-party cloud providers (Groq) lacked embeddings endpoints, causing zero-vector degradation. Sending sensitive Pakistani legal client documents (T3 tier) to external APIs violates client confidentiality rules ([D-005](file:///f:/lawyer_agency/docs/decision-log.md)).
- **Execution:**
  1. Drops legacy 1536-dim HNSW indexes.
  2. Sets all legacy vectors to `NULL`.
  3. Alters column types: `ALTER TABLE app.kb_chunks ALTER COLUMN embedding TYPE vector(384)`.
  4. Alters column types: `ALTER TABLE app.document_chunks ALTER COLUMN embedding TYPE vector(384)`.
  5. Rebuilds HNSW indexes with cosine distance metric for `intfloat/multilingual-e5-small`.

---

## 3. Forward & Rollback Operational Policies

- **Forward-Only Rule:** Production databases strictly enforce forward migrations (`prisma migrate deploy`). Destructive down-migrations are prohibited.
- **Rollback Procedure:** If a migration fails in staging or production, a compensatory forward migration (`0031_...`) must be authored and deployed.
- **Zero-Downtime Guarantee:** Column additions must be nullable or carry explicit default values. Renaming or dropping columns requires a two-phase rollout (deprecate in code, drop in subsequent release).
