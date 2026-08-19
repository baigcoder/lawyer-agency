-- 0018_tenant_features — platform-level entitlement gate for paid capabilities.
--
-- Used first for the official WhatsApp Business API upgrade: a tenant must
-- have an ACTIVE TenantFeature row with code = 'OFFICIAL_WHATSAPP' before
-- Meta Embedded Signup can be completed. Free pilot connections are unaffected.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TenantFeatureStatus' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'platform')
  ) THEN
    CREATE TYPE "platform"."TenantFeatureStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TenantFeatureCode' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'platform')
  ) THEN
    CREATE TYPE "platform"."TenantFeatureCode" AS ENUM ('OFFICIAL_WHATSAPP');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "platform"."tenant_features" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "platform"."tenants"("id") ON DELETE CASCADE,
  "code" "platform"."TenantFeatureCode" NOT NULL,
  "status" "platform"."TenantFeatureStatus" NOT NULL DEFAULT 'INACTIVE',
  "expiresAt" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_features_tenantId_code_idx"
  ON "platform"."tenant_features"("tenantId", "code");

CREATE INDEX IF NOT EXISTS "tenant_features_tenantId_status_idx"
  ON "platform"."tenant_features"("tenantId", "status");

-- Only the platform (or a later provisioning flow) should write feature rows.
-- Reads from the app role are needed for entitlement checks inside withTenant,
-- but writes remain platform-scoped.
GRANT SELECT, INSERT, UPDATE ON "platform"."tenant_features" TO app_user;

COMMIT;
