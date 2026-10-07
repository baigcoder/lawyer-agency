# Wakeel — RAG Architecture & Legal Knowledge Retrieval

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Retrieval-Augmented Generation, pgvector Indexing, and Knowledge Pipeline  
**Source Code References:** `apps/api/src/modules/rag/`, `apps/api/src/modules/documents/`  

---

## 1. RAG Architecture Overview (Phase 8, D-060–D-064, D-108)

Wakeel’s Retrieval-Augmented Generation pipeline grounds AI answers strictly in:
1. The law firm’s published FAQs (`app.knowledge_base` with `status: PUBLISHED`).
2. The shared **Pakistan Legal-Process Knowledge Pack** (consultation, vakalatnama, FIR, bail, family law, property, civil procedures).
3. Pinned client documents (`app.document_chunks` with `isPinned: true`).

```text
Document / FAQ Creation ──► Text Extraction (pdf-parse / mammoth)
                                      │
                                      ▼
                             Character Chunking (~400 chars, paragraph overlap)
                                      │
                                      ▼
                             EmbeddingClient (Local multilingual-e5-small, 384 dims)
                                      │
                                      ▼
                             PostgreSQL pgvector (HNSW Cosine Index)
                                      │
Client Question ──────────────────────┼──────────────────────►
                                      ▼
                             VectorRetriever (Tenant-Scoped Raw SQL Query)
                                      │
                                      ▼
                             Top Chunks Injected into FaqAgent Prompt Context
```

---

## 2. Local Privacy-Preserving Embeddings (D-005, D-029)

- **Local Model:** `intfloat/multilingual-e5-small` running via HuggingFace Text Embeddings Inference (`embeddings` container on port 8081).
- **Zero Third-Party Data Leakage:** Client court records, deeds, and case files are embedded locally on the firm's private infrastructure. Raw text is never transmitted to external embedding APIs.
- **Dimensions:** 384 dimensions matching migration `0029_local_embeddings_384`.

---

## 3. Tenant-Scoped Retrieval Query (`VectorRetriever`)

Because vector similarity operators cannot be represented cleanly in standard Prisma schemas, retrieval executes via audited `$queryRaw` strictly bound inside `UnitOfWork.withTenant`:

```sql
SELECT
  kc.id,
  kc."chunkText",
  kb.title,
  1 - (kc.embedding <=> $1::vector) AS similarity
FROM app.kb_chunks kc
JOIN app.knowledge_base kb ON kb.id = kc."knowledgeBaseId"
WHERE kb.status = 'PUBLISHED'
ORDER BY kc.embedding <=> $1::vector ASC
LIMIT 4;
```

RLS on `app.kb_chunks` and `app.knowledge_base` guarantees that no chunks from other law firms are ever returned in search results.

---

## 4. Hybrid Keyword Search Fallback

If the local embedding service is temporarily restarting or experiencing resource contention:
- `ResilientRetriever` automatically falls back to full-text keyword matching (`simple-retriever.ts`).
- Roman Urdu terms are normalized (e.g. *"talaaq"* → *"talaq"*, *"zameen"* → *"property"*), ensuring continuity of service without crashing client intake.
