-- ---------------------------------------------------------------------------
-- Quick replies: firm-wide saved messages lawyers insert into the inbox reply
-- box. Text only, with {placeholders} the dashboard fills from the
-- conversation. Sent as normal messages, so no Meta template approval.
-- ---------------------------------------------------------------------------
CREATE TABLE "app"."quick_replies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quick_replies_language_check" CHECK ("language" IN ('en', 'ur'))
);

CREATE UNIQUE INDEX "quick_replies_tenantId_title_language_key" ON "app"."quick_replies"("tenantId", "title", "language");

ALTER TABLE "app"."quick_replies"
  ADD CONSTRAINT "quick_replies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (D-020)
ALTER TABLE "app"."quick_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."quick_replies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."quick_replies"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."quick_replies" TO app_user;
