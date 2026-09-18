-- ---------------------------------------------------------------------------
-- Replace zero-vector "embeddings" with NULL.
--
-- When the embedding provider was unavailable, knowledge-base indexing stored
-- a 1536-dimension zero vector instead of failing. Those rows:
--   - count as embedded in `count(embedding)`, so the gap was invisible;
--   - sit in the HNSW index and return an identical distance for every query,
--     so semantic search silently ranked noise;
--   - are skipped by nothing, so a later fix to the provider never re-indexed.
--
-- NULL is the honest value. VectorRetriever already filters
-- `embedding IS NOT NULL`, keyword retrieval still finds these chunks, and
-- `POST /v1/knowledge-base/reindex` re-embeds exactly these rows.
--
-- A real embedding is unit-normalised (norm 1.0), so a zero norm is
-- unambiguous. Idempotent: re-running changes nothing.
-- ---------------------------------------------------------------------------
UPDATE app.kb_chunks
SET embedding = NULL
WHERE embedding IS NOT NULL AND vector_norm(embedding) = 0;

UPDATE app.document_chunks
SET embedding = NULL
WHERE embedding IS NOT NULL AND vector_norm(embedding) = 0;
