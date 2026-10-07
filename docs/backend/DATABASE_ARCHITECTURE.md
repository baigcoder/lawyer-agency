# Wakeel — Database Architecture & Storage Engine

**Status:** IMPLEMENTED BASELINE & SCHEMA SPECIFICATION  
**Classification:** Database Architecture, Schemas, Partitioning, and Vector Indexes  
**Engine Baseline:** PostgreSQL 16 with pgvector extension, Prisma 7 (`@prisma/adapter-pg`)  
**Migrations on Disk:** 30 Handcrafted Migrations (`0001_init` through `0030_ai_logs_queued_ms`)  

---

## 1. Dual-Schema Topology (D-001, D-019)

```text
┌────────────────────────────────────────────────────────┐
│               POSTGRESQL 16 DATABASE                   │
├──────────────────────────┬─────────────────────────────┤
│ SCHEMA: "platform"       │ SCHEMA: "app"               │
│ (Cross-Tenant Core)      │ (Tenant-Isolated Operat.)   │
├──────────────────────────┼─────────────────────────────┤
│ • tenants                │ • users, lawyers, roles     │
│ • wa_routes              │ • clients, cases, hearings  │
│ • webhook_events         │ • conversations, messages   │
│ • outbox_events          │ • escalations, intake       │
│ • prompt_versions        │ • appointments, payments    │
│ • permissions            │ • documents, document_chunks│
│ • analytics_daily        │ • knowledge_base, kb_chunks │
├──────────────────────────┼─────────────────────────────┤
│ NO RLS (Infra Access)    │ FORCE ROW LEVEL SECURITY    │
└──────────────────────────┴─────────────────────────────┘
```

---

## 2. Table Partitioning Strategy (D-021)

High-volume tables that grow indefinitely are partitioned using native PostgreSQL **RANGE Partitioning** by month:
- **Partitioned Tables:** `app.messages`, `app.audit_logs`, `app.ai_logs`.
- **Partition Key:** `createdAt` timestamp with composite primary key `(id, "createdAt")`.
- **Pre-created Partitions:** 6 months of rolling forward partitions plus a `_default` partition catch-all created via migration DDL (`migration 0003_partitions_and_vector`).
- **Query Optimization:** Queries specifying `createdAt` filter ranges leverage PostgreSQL partition pruning, avoiding full table scans over historical messaging archives.

---

## 3. Vector Embeddings Architecture (pgvector)

- **Vector Column:** Stored in `app.kb_chunks(embedding)` and `app.document_chunks(embedding)`.
- **Embedding Dimensions:** 384 dimensions (`vector(384)`) matching local `intfloat/multilingual-e5-small` embeddings (migration `0029_local_embeddings_384`).
- **Vector Index:** **HNSW (Hierarchical Navigable Small World)** index utilizing cosine distance operator (`<=>`):
  ```sql
  CREATE INDEX document_chunks_embedding_hnsw_idx
    ON app.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ```
- **Prisma Integration:** Because Prisma schema cannot express native vector types (`Unsupported("vector(384)")`), all semantic retrieval queries execute via raw SQL `$queryRaw` bound strictly inside the tenant transaction context (`UnitOfWork.withTenant`).

---

## 4. Exclusion Constraints & Idempotency Indexes

1. **Double-Booking Exclusion Constraint:** An appointment exclusion constraint prevents overlapping bookings for the same advocate within the same time window.
2. **Webhook Idempotency Index:** A unique partial index on `platform.webhook_events(externalEventId)` acts as the primary deduplication fence against duplicate WhatsApp delivery webhooks.
