-- 0014_pilot_sessions — free Baileys pilot WhatsApp sessions (D-092).
--
-- One row per tenant (unique tenantId), tenant-scoped like every app table:
-- RLS FORCE + tenant_isolation policy keyed to app.tenant_id (D-020).
-- sessionCredsEnc holds AES-256-GCM ciphertext of Baileys session creds.

CREATE TYPE "app"."PilotSessionStatus" AS ENUM ('PAIRING', 'PAIRED', 'EXPIRED', 'DISCONNECTED');

CREATE TABLE "app"."pilot_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "status" "app"."PilotSessionStatus" NOT NULL DEFAULT 'PAIRING',
    "allowlist" JSONB NOT NULL DEFAULT '[]',
    "sessionCredsEnc" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pilot_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "app"."pilot_sessions" ADD CONSTRAINT "pilot_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pilot_sessions_tenantId_key" ON "app"."pilot_sessions"("tenantId");

ALTER TABLE "app"."pilot_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."pilot_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."pilot_sessions"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."pilot_sessions" TO app_user;
