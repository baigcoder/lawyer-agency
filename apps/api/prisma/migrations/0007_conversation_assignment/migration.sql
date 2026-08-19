-- Dashboard inbox assignment support (Phase 11)
ALTER TABLE "app"."conversations" ADD COLUMN "assignedToId" UUID;
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "app"."users"(id) ON DELETE SET NULL;
CREATE INDEX "conversations_assignedToId_idx" ON "app"."conversations"("assignedToId");
CREATE INDEX "conversations_tenant_assignedTo_idx" ON "app"."conversations"("tenantId", "assignedToId");

ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "app"."users"(id) ON DELETE SET NULL;
CREATE INDEX "messages_senderUserId_idx" ON "app"."messages"("senderUserId");
