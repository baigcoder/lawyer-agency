-- ---------------------------------------------------------------------------
-- HNSW index for client-document retrieval (Phase 8 follow-up).
--
-- `app.kb_chunks` got its vector index in migration 0003, but the document
-- chunks added in 0020 only ever had a btree on ("tenantId", "documentId").
-- Every AI turn for a client with uploaded documents therefore ran a full
-- sequential scan plus sort over `document_chunks` before it could reply.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
  ON app.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
