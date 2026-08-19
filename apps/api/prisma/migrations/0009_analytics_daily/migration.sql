-- Analytics CQRS read model (Phase 14, D-018)
CREATE TABLE "platform"."analytics_daily" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  date DATE NOT NULL,
  "newConversations" INT NOT NULL DEFAULT 0,
  "aiHandled" INT NOT NULL DEFAULT 0,
  "humanHandled" INT NOT NULL DEFAULT 0,
  escalations INT NOT NULL DEFAULT 0,
  "casesOpened" INT NOT NULL DEFAULT 0,
  "casesClosed" INT NOT NULL DEFAULT 0,
  "paymentsCents" INT NOT NULL DEFAULT 0,
  "avgFirstResponseSec" INT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "analytics_daily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"(id) ON DELETE CASCADE,
  CONSTRAINT "analytics_daily_tenantId_date_key" UNIQUE ("tenantId", date)
);
CREATE INDEX "analytics_daily_tenant_date_idx" ON "platform"."analytics_daily"("tenantId", date);
