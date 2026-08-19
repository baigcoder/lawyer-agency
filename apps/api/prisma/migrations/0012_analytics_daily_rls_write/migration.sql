-- 0012_analytics_daily_rls_write — the tenant-isolation policy on
-- platform.analytics_daily only allowed SELECT. The analytics projector
-- upserts rows, so INSERT/UPDATE need the same fail-closed check.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'platform' AND tablename = 'analytics_daily' AND policyname = 'analytics_daily_tenant_isolation_insert_update'
  ) THEN
    CREATE POLICY analytics_daily_tenant_isolation_insert_update ON platform.analytics_daily
      FOR ALL TO app_user
      USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
