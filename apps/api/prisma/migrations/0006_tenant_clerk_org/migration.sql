-- Map Clerk organizations to tenants (D-017)
ALTER TABLE "platform"."tenants" ADD COLUMN "clerkOrgId" TEXT;
CREATE UNIQUE INDEX "tenants_clerkOrgId_key" ON "platform"."tenants"("clerkOrgId");
