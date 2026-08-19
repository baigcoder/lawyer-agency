-- Roadmap features (D-110+): firm payment details, court hearings, conversation notes, client CNIC.

ALTER TABLE "app"."clients" ADD COLUMN IF NOT EXISTS "cnic" TEXT;

CREATE TABLE IF NOT EXISTS "app"."firm_payment_details" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "detailsEnc" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "firm_payment_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "firm_payment_details_tenantId_key" ON "app"."firm_payment_details"("tenantId");

ALTER TABLE "app"."firm_payment_details"
  ADD CONSTRAINT "firm_payment_details_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "app"."court_hearings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "caseId" UUID NOT NULL,
  "courtName" TEXT NOT NULL,
  "judge" TEXT,
  "hearingAt" TIMESTAMPTZ(6) NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "reminderSentAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "court_hearings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "court_hearings_tenantId_hearingAt_idx" ON "app"."court_hearings"("tenantId", "hearingAt");
CREATE INDEX IF NOT EXISTS "court_hearings_tenantId_caseId_idx" ON "app"."court_hearings"("tenantId", "caseId");

ALTER TABLE "app"."court_hearings"
  ADD CONSTRAINT "court_hearings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "court_hearings_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "app"."cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "app"."conversation_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_notes_tenantId_conversationId_idx" ON "app"."conversation_notes"("tenantId", "conversationId");

ALTER TABLE "app"."conversation_notes"
  ADD CONSTRAINT "conversation_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_notes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "app"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (D-020)
ALTER TABLE "app"."firm_payment_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."firm_payment_details" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."firm_payment_details"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "app"."court_hearings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."court_hearings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."court_hearings"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "app"."conversation_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."conversation_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."conversation_notes"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."firm_payment_details" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."court_hearings" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."conversation_notes" TO app_user;
