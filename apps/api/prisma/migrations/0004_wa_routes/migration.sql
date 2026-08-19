-- 0004_wa_routes — pre-tenant routing table (D-040, Phase 6).
-- Webhook payloads identify the firm only by Meta's phone_number_id; this
-- platform-schema table resolves it to a tenant before RLS-scoped work.

CREATE TABLE platform.wa_routes (
    "phoneNumberId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "wabaId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_routes_pkey" PRIMARY KEY ("phoneNumberId")
);

ALTER TABLE platform.wa_routes
  ADD CONSTRAINT "wa_routes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES platform.tenants("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ingest path reads it; onboarding (6b) writes it. No RLS (infrastructure),
-- access limited to the app role's narrow platform grants.
GRANT SELECT, INSERT, UPDATE ON platform.wa_routes TO app_user;
