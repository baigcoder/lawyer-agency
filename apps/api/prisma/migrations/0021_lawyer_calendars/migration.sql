-- Add Google Calendar sync support for lawyer appointments.

-- Appointment columns for external calendar sync and client confirmation tracking.
ALTER TABLE "app"."appointments"
  ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "externalCalendarId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalEventId" TEXT;

-- Lawyer calendar connection storage (refresh token encrypted at rest).
CREATE TABLE IF NOT EXISTS "app"."lawyer_calendars" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "lawyerId" UUID NOT NULL,
  "googleRefreshTokenEnc" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL DEFAULT 'primary',
  "connectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "lawyer_calendars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lawyer_calendars_lawyerId_key" ON "app"."lawyer_calendars"("lawyerId");
CREATE INDEX IF NOT EXISTS "lawyer_calendars_tenantId_idx" ON "app"."lawyer_calendars"("tenantId");

ALTER TABLE "app"."lawyer_calendars"
  ADD CONSTRAINT "lawyer_calendars_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lawyer_calendars_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "app"."lawyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
