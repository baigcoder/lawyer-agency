-- Add unique constraint for one intake session per tenant/conversation
CREATE UNIQUE INDEX "intake_sessions_tenantId_conversationId_key" ON "app"."intake_sessions"("tenantId", "conversationId");
