-- WhatsApp Cloud Calling receptionist (D-124).

ALTER TYPE "app"."ContentType" ADD VALUE IF NOT EXISTS 'CALL';

CREATE TYPE "app"."VoiceCallStatus" AS ENUM ('RINGING', 'ANSWERED', 'REJECTED', 'COMPLETED', 'FAILED');
CREATE TYPE "app"."VoiceCallDisposition" AS ENUM (
  'BOOKED',
  'ESCALATED',
  'INFO',
  'ABANDONED',
  'REJECTED_OFF',
  'BAILEYS_UNSUPPORTED',
  'OUTSIDE_HOURS'
);

CREATE TABLE "app"."voice_calls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "providerCallId" TEXT NOT NULL,
  "fromWaPhone" TEXT NOT NULL,
  "instanceName" TEXT NOT NULL,
  "status" "app"."VoiceCallStatus" NOT NULL DEFAULT 'RINGING',
  "disposition" "app"."VoiceCallDisposition",
  "summary" TEXT,
  "transcriptPath" TEXT,
  "inboxMessageId" UUID,
  "appointmentId" UUID,
  "escalationId" UUID,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMPTZ(6),
  "endedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_calls_tenantId_providerCallId_key" ON "app"."voice_calls"("tenantId", "providerCallId");
CREATE INDEX "voice_calls_tenantId_conversationId_idx" ON "app"."voice_calls"("tenantId", "conversationId");
CREATE INDEX "voice_calls_tenantId_status_idx" ON "app"."voice_calls"("tenantId", "status");

ALTER TABLE "app"."voice_calls"
  ADD CONSTRAINT "voice_calls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "voice_calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "app"."conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "app"."voice_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."voice_calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "app"."voice_calls"
  USING (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (("tenantId") = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."voice_calls" TO app_user;
