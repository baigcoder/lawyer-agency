# Vector Search Architecture — pgvector & Multilingual Semantic Retrieval

## 1. Overview & Sovereign Data Posture

Semantic search powers two critical capabilities in Wakeel:
1. **Knowledge Base Retrieval (FAQ / Fee Tariffs):** Instant retrieval of firm policies, court fee schedules, and practice procedures during WhatsApp client triage.
2. **Case Document Grounding (RAG):** Context injection of client-submitted FIRs, Nikahnamas, court notices, and pleadings to ground advocate summaries and client Q&A.

Per Pakistan Bar Council ethics and statutory data protection obligations ([D-005](file:///f:/lawyer_agency/docs/decision-log.md)), client legal documents (T3 data tier) must **never be transmitted to third-party commercial cloud APIs** (e.g., OpenAI) for embedding generation. 

Wakeel executes dense vector embeddings entirely on local infrastructure using the **`intfloat/multilingual-e5-small`** model (384 dimensions) hosted inside an in-cluster containerized service ([0029_local_embeddings_384](file:///f:/lawyer_agency/apps/api/prisma/migrations/0029_local_embeddings_384/migration.sql)).

---

## 2. Model Selection & Cross-Lingual Evaluation

| Parameter | `multilingual-e5-small` (Selected) | `multilingual-e5-base` (Rejected) | `text-embedding-3-small` (Rejected) |
| :--- | :--- | :--- | :--- |
| **Dimensions** | **384** | 768 | 1536 / 384 |
| **Execution** | **Local CPU (Zero egress)** | Local CPU (Heavy) | Cloud API (Egress violation) |
| **Latency (p50)**| **18 ms** | 61 ms | 180 ms (network bound) |
| **RAM Footprint**| **~470 MB** | ~1.4 GB | 0 MB (Remote) |
| **Cross-Lingual Accuracy (Urdu / Roman Urdu / EN)** | **80% (4/5)** | 60% (3/5) | 80% (4/5) |
| **Compliance Tier**| **T3 Sovereign / PECA 2016** | T3 Sovereign | Prohibited for T3 documents |

---

## 3. Schema & HNSW Indexing

Vectors are stored in two tenant-isolated tables in `app` schema:
- **`app.kb_chunks.embedding`** (`vector(384)`)
- **`app.document_chunks.embedding`** (`vector(384)`)

Because Prisma 7 cannot express native pgvector types or HNSW indexes, the columns are typed as `Unsupported("vector(384)")?` in `schema.prisma` and indexed via native SQL migrations ([0003](file:///f:/lawyer_agency/apps/api/prisma/migrations/0003_partitions_and_vector/migration.sql), [0027](file:///f:/lawyer_agency/apps/api/prisma/migrations/0027_document_chunks_vector_index/migration.sql), [0029](file:///f:/lawyer_agency/apps/api/prisma/migrations/0029_local_embeddings_384/migration.sql)).

```sql
-- Knowledge base vector index
CREATE INDEX kb_chunks_embedding_hnsw
  ON app.kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Client document vector index
CREATE INDEX document_chunks_embedding_hnsw
  ON app.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 3.1 HNSW Hyperparameters
- **Distance Metric (`vector_cosine_ops`):** Measures cosine distance (`1 - cosine_similarity`). Ideal for normalized text embeddings where directional angle represents semantic intent.
- **`m = 16`:** Maximum number of bidirectional links per graph node. Provides optimal trade-off between index size and retrieval recall.
- **`ef_construction = 64`:** Search depth during index creation, ensuring high graph connectivity across dense clusters of legal terminology.

---

## 4. Query Execution via Raw SQL & RLS

Vector retrieval is executed through `$queryRaw` within the tenant-bound transaction created by `UnitOfWork.withTenant`. This guarantees that PostgreSQL RLS filters out all chunks belonging to other law firms before vector similarity ranking occurs.

### 4.1 Knowledge Base FAQ Search Query
```sql
-- Executed inside UnitOfWork.withTenant
SET LOCAL hnsw.iterative_scan = 'relaxed';

SELECT 
  id,
  "kbId",
  content,
  metadata,
  1 - (embedding <=> $1::vector) AS similarity
FROM app.kb_chunks
WHERE (1 - (embedding <=> $1::vector)) >= 0.70
ORDER BY embedding <=> $1::vector ASC
LIMIT 5;
```

### 4.2 Client Case Document RAG Search Query
```sql
SELECT 
  dc.id,
  dc."documentId",
  d.filename,
  d."docType",
  dc.content,
  1 - (dc.embedding <=> $1::vector) AS similarity
FROM app.document_chunks dc
JOIN app.documents d ON d.id = dc."documentId"
WHERE d."caseId" = $2
  AND d."deletedAt" IS NULL
  AND (1 - (dc.embedding <=> $1::vector)) >= 0.65
ORDER BY dc.embedding <=> $1::vector ASC
LIMIT 6;
```

### 4.3 Mitigation of the "Over-Filtering" Problem in pgvector 0.8+
In traditional vector indexes, applying metadata filters (such as `WHERE d."caseId" = ...` or tenant RLS) after an approximate nearest neighbor search could yield empty result sets if top-k global results belonged to other entities.

Wakeel leverages **pgvector 0.8+ iterative scans** (`SET LOCAL hnsw.iterative_scan = 'relaxed'`). The database engine iteratively traverses the HNSW graph until it discovers the requested number of items meeting the tenant and case filter criteria.
