-- Notification channel support (Phase 12)
ALTER TYPE "app"."NotificationChannel" ADD VALUE IF NOT EXISTS 'EMAIL_DIGEST';

ALTER TABLE "app"."users" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSON NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "app"."push_subscriptions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "push_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"(id) ON DELETE CASCADE,
  CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."users"(id) ON DELETE CASCADE,
  CONSTRAINT "push_subscriptions_userId_endpoint_key" UNIQUE ("userId", endpoint)
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_tenant_user_idx" ON "app"."push_subscriptions"("tenantId", "userId");

-- RLS policy helper: push subscriptions are tenant-scoped
ALTER TABLE "app"."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."push_subscriptions" FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'app' AND tablename = 'push_subscriptions' AND policyname = 'push_subscriptions_tenant_isolation'
  ) THEN
    CREATE POLICY "push_subscriptions_tenant_isolation" ON "app"."push_subscriptions"
      FOR ALL TO app_user
      USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
