-- 0010_analytics_daily_rls — fix missing tenant isolation on the Phase 14
-- read model. The table lives in `platform` (cross-tenant infra) but holds
-- tenant-scoped rows, so it needs the same fail-closed policy as `app.*`
-- tables plus an explicit grant (platform is not covered by the
-- ALTER DEFAULT PRIVILEGES ... IN SCHEMA app clause in 0002).

-- app_user must be able to read its own tenant's projections.
GRANT SELECT ON platform.analytics_daily TO app_user;

-- Fail-closed tenant isolation (mirrors app.* policy from 0002).
ALTER TABLE platform.analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.analytics_daily FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'platform' AND tablename = 'analytics_daily' AND policyname = 'analytics_daily_tenant_isolation'
  ) THEN
    CREATE POLICY analytics_daily_tenant_isolation ON platform.analytics_daily
      FOR SELECT TO app_user
      USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;