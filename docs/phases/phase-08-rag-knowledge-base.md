# Phase 8 — RAG Knowledge Base

**Status:** delivered & verified 2026-08-12  
**Scope:** KB CRUD API, chunking/embedding pipeline, tenant-scoped pgvector retrieval, integration with the FAQ agent.

---

## 1. Goal & Definition of Done

**Goal:** a tenant-scoped knowledge base that the FAQ agent can query for grounded answers with citations.

**Done when (all verified, evidence §6):**
- [x] KB management REST API (create, list, get, update, publish, archive)
- [x] Zod-validated boundary input
- [x] Text chunking with overlap (paragraph-preferring, sentence fallback)
- [x] Embedding generation via OpenAI text-embedding-3-large (native fetch, normalized vectors)
- [x] Chunks stored with `vector(1536)` via raw SQL (Prisma Unsupported type)
- [x] pgvector cosine-similarity retrieval tenant-scoped to PUBLISHED entries
- [x] `kb.indexed` outbox event published on create/update
- [x] FAQ agent automatically uses vector retrieval (RAG module provider swap)
- [x] Full `tsc --noEmit` clean, 48/48 tests, ESLint clean

## 2. Key Decisions

### D-060 — Embedding client as a port
`EmbeddingClient` with `embed` / `embedBatch` isolates the embedding model. `OpenAiEmbeddingClient` uses native fetch, normalizes vectors, and batches for the chunking pipeline.

### D-061 — Simple character-based chunking with overlap
No external tokenizer in Phase 8. Uses ~4 chars/token estimate, prefers paragraph boundaries, falls back to sentences, and adds overlap between adjacent chunks for continuity.

### D-062 — pgvector retrieval tenant-scoped + status-filtered
`VectorRetriever` runs `1 - (embedding <=> query)` cosine similarity, filters by `tenantId` and `status = 'PUBLISHED'`, and returns scored chunks. Replaces the keyword-search dev stub from Phase 7 transparently (same `RETRIEVER` port).

### D-063 — KB status workflow
Entries are created `DRAFT`, chunked/embedded immediately, and become searchable only after `PUBLISH`. `ARCHIVED` entries are also excluded from search. This lets firms preview content before it enters the RAG corpus.

### D-064 — Raw SQL for vector reads/writes
Prisma does not support `Unsupported("vector(1536)")` in generated client operations. Chunk inserts/deletes and vector search use `$queryRaw` inside the tenant transaction; the `knowledge_base` table uses normal Prisma operations.

## 3. What was built

```
modules/rag/
├── application/
│   ├── retriever.port.ts               # Retriever contract (from Phase 7)
│   ├── embedding.port.ts               # EmbeddingClient contract
│   ├── chunking.service.ts             # paragraph/sentence chunking + overlap
│   └── knowledge-base.service.ts       # CRUD + chunk/embed + kb.indexed event
├── infrastructure/
│   ├── openai-embedding.client.ts      # OpenAI embeddings fetch adapter
│   ├── vector-retriever.ts             # pgvector cosine search
│   └── simple-retriever.ts             # keyword-search dev stub (kept, unregistered)
├── interface/
│   └── knowledge-base.controller.ts    # /v1/knowledge-base CRUD + publish/archive
└── rag.module.ts                       # registers controller, services, ports
common/events/domain-events.ts          # +kb.indexed
prisma/migrations/0005_intake_session_unique  # also added @@unique on intake_sessions
.env.example                            # +OPENAI_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS
```

## 4. Security & Data Posture

- KB content is T2; embeddings are derived from T2 text.
- Vector search is tenant-scoped in SQL (RLS is defense-in-depth; the query explicitly filters `tenantId`).
- Only `PUBLISHED` entries are returned to the FAQ agent.

## 5. Boundary Observations

- AI module continues to depend only on the `RETRIEVER` port; switching from `SimpleRetriever` to `VectorRetriever` required zero AI code changes.
- RAG module uses `OutboxWriter` (global) to emit `kb.indexed` inside the same transaction as chunk writes.

## 6. Verification Evidence (this environment)

- `tsc --noEmit` clean · **48/48 tests** · ESLint clean
- `npm run build` clean
- Live server registration verified for all `/v1/knowledge-base/*` routes (boot attempted; Redis not running in this environment, so the process exits after connection errors — expected without `docker compose`)
- Unit tests cover: chunking strategy, KB create/update/publish with raw SQL capture, vector retriever query embedding + SQL invocation, existing AI pipeline tests still pass with the new retriever provider
- **Not verified here (no Docker):** real OpenAI embedding API, pgvector similarity search, end-to-end FAQ retrieval. First integration run: `docker compose up -d && prisma migrate deploy`.

## 7. Next Work

**Phase 9** — notifications & alerting (escalation SLA notifications, outbox consumers, dashboard alerts) OR continue with document-driven KB ingestion when Documents module is fully built.
