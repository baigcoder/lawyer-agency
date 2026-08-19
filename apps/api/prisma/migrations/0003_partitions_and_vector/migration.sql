-- 0003_partitions_and_vector — scale layer.
--
-- messages / audit_logs / ai_logs are the three unbounded tables
-- (~640k msgs/day at year-1 target, Phase 1 §7). They become RANGE-partitioned
-- by "createdAt" (monthly) so retention = DROP PARTITION and vacuum pressure
-- stays per-partition. Runs immediately after 0001 on every environment, so
-- the legacy tables are always empty here — the copy step is belt-and-braces.
--
-- Partition maintenance: six months are pre-created; an ops job (Phase 15)
-- creates future months. The DEFAULT partition catches stragglers so inserts
-- never fail — it must stay empty and is monitored.

DO $$
DECLARE
  parents  text[] := ARRAY['messages', 'audit_logs', 'ai_logs'];
  p        text;
  m        date;
BEGIN
  FOREACH p IN ARRAY parents LOOP
    -- 1. Set the 0001 table aside (its indexes/constraints keep their names).
    EXECUTE format('ALTER TABLE app.%I RENAME TO %I', p, p || '_legacy');

    -- 2. Partitioned parent: same shape, no PK yet (PG requires the partition
    --    key in the PK, so it becomes (id, "createdAt") below).
    EXECUTE format(
      'CREATE TABLE app.%I (LIKE app.%I INCLUDING DEFAULTS) PARTITION BY RANGE ("createdAt")',
      p, p || '_legacy');

    -- 3. Monthly partitions (six months ahead) + DEFAULT safety net.
    FOR m IN SELECT generate_series(date_trunc('month', now())::date - interval '1 month',
                                    date_trunc('month', now())::date + interval '5 months',
                                    interval '1 month')::date
    LOOP
      EXECUTE format(
        'CREATE TABLE app.%I PARTITION OF app.%I FOR VALUES FROM (%L) TO (%L)',
        p || '_' || to_char(m, 'YYYY_MM'), p, m, m + interval '1 month');
    END LOOP;
    EXECUTE format('CREATE TABLE app.%I PARTITION OF app.%I DEFAULT', p || '_default', p);

    -- 4. Copy (empty on fresh deploys), then drop the legacy table, freeing
    --    constraint/index names for the parent.
    EXECUTE format('INSERT INTO app.%I SELECT * FROM app.%I', p, p || '_legacy');
    EXECUTE format('DROP TABLE app.%I', p || '_legacy');

    -- 5. Final constraints/indexes on the parent (propagate to partitions).
    EXECUTE format('ALTER TABLE app.%I ADD PRIMARY KEY (id, "createdAt")', p);
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', p);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', p);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (("tenantId") = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (("tenantId") = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      p);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON app.%I TO app_user', p);
  END LOOP;
END $$;

-- Per-table indexes, FKs, and grants (names match 0001's so Prisma's view of
-- the world stays consistent).

-- messages
ALTER TABLE app.messages
  ADD CONSTRAINT "messages_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES platform.tenants("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE app.messages
  ADD CONSTRAINT "messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES app.conversations("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "messages_conversationId_createdAt_idx" ON app.messages ("conversationId", "createdAt");
CREATE INDEX "messages_tenantId_createdAt_idx" ON app.messages ("tenantId", "createdAt");
CREATE INDEX "messages_wamid_idx" ON app.messages (wamid);

-- audit_logs: append-only, even as partitioned (revoke re-applied).
ALTER TABLE app.audit_logs
  ADD CONSTRAINT "audit_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES platform.tenants("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON app.audit_logs ("tenantId", "createdAt");
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON app.audit_logs ("tenantId", "entityType", "entityId");
REVOKE UPDATE, DELETE ON app.audit_logs FROM app_user;

-- ai_logs
ALTER TABLE app.ai_logs
  ADD CONSTRAINT "ai_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES platform.tenants("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE app.ai_logs
  ADD CONSTRAINT "ai_logs_promptVersionId_fkey"
  FOREIGN KEY ("promptVersionId") REFERENCES platform.prompt_versions("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ai_logs_tenantId_createdAt_idx" ON app.ai_logs ("tenantId", "createdAt");
CREATE INDEX "ai_logs_correlationId_idx" ON app.ai_logs ("correlationId");

-- ---------------------------------------------------------------------------
-- RAG vector index (FR-KB-02). HNSW over cosine; pgvector 0.8+ iterative
-- scans keep per-tenant filtered retrieval correct and fast (Phase 8).
-- ---------------------------------------------------------------------------
CREATE INDEX kb_chunks_embedding_hnsw
  ON app.kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
