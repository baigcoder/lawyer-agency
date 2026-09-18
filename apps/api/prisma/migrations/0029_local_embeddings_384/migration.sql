-- ---------------------------------------------------------------------------
-- Move embeddings to 384 dimensions for the local multilingual-e5-small model.
--
-- The 1536-dimension columns assumed OpenAI text-embedding-3. Embeddings now
-- come from a local model because:
--   - Groq, the only provider configured, has no embeddings endpoint, so every
--     KB chunk had been stored as a zero vector and semantic search was inert;
--   - T3 client documents must not be sent to a third-party provider by
--     default (D-005); embedding them locally keeps them on our infrastructure;
--   - measured on Urdu script, Roman Urdu and English legal queries, e5-small
--     matched 4/5 cross-lingually against 3/5 for the larger e5-base, at 18ms
--     p50 against 61ms.
--
-- 384 also stays compatible with OpenAI should a firm want it:
-- text-embedding-3-* accepts `dimensions: 384`.
--
-- Existing vectors cannot be converted between dimensions and were zero
-- vectors anyway (see 0028), so they are cleared; `POST /v1/knowledge-base/
-- reindex` rebuilds them. The HNSW indexes are rebuilt for the new width.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS app.kb_chunks_embedding_hnsw;
DROP INDEX IF EXISTS app.document_chunks_embedding_hnsw;

UPDATE app.kb_chunks SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE app.document_chunks SET embedding = NULL WHERE embedding IS NOT NULL;

ALTER TABLE app.kb_chunks ALTER COLUMN embedding TYPE vector(384);
ALTER TABLE app.document_chunks ALTER COLUMN embedding TYPE vector(384);

CREATE INDEX kb_chunks_embedding_hnsw
  ON app.kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX document_chunks_embedding_hnsw
  ON app.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
