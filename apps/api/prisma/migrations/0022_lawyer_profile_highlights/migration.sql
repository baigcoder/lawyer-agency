-- Lawyer professional profile fields + anonymized case highlights for AI (T1-safe).

ALTER TABLE "app"."lawyers"
  ADD COLUMN IF NOT EXISTS "bio" TEXT,
  ADD COLUMN IF NOT EXISTS "bioUr" TEXT,
  ADD COLUMN IF NOT EXISTS "yearsExperience" INTEGER,
  ADD COLUMN IF NOT EXISTS "barCouncil" TEXT,
  ADD COLUMN IF NOT EXISTS "barEnrollmentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "education" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "achievements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "app"."lawyer_case_highlights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "lawyerId" UUID NOT NULL,
  "caseId" UUID NOT NULL,
  "publicTitle" TEXT NOT NULL,
  "publicOutcome" TEXT NOT NULL,
  "consentRecordedAt" TIMESTAMPTZ(6) NOT NULL,
  "visibleToAi" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "lawyer_case_highlights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lawyer_case_highlights_lawyerId_caseId_key"
  ON "app"."lawyer_case_highlights"("lawyerId", "caseId");
CREATE INDEX IF NOT EXISTS "lawyer_case_highlights_tenantId_lawyerId_idx"
  ON "app"."lawyer_case_highlights"("tenantId", "lawyerId");

ALTER TABLE "app"."lawyer_case_highlights"
  ADD CONSTRAINT "lawyer_case_highlights_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lawyer_case_highlights_lawyerId_fkey"
    FOREIGN KEY ("lawyerId") REFERENCES "app"."lawyers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lawyer_case_highlights_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "app"."cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (tenant isolation, same pattern as 0002).
ALTER TABLE "app"."lawyer_case_highlights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."lawyer_case_highlights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."lawyer_case_highlights"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."lawyer_case_highlights" TO app_user;
