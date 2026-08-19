-- CreateTable
CREATE TABLE "app"."whatsapp_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "instanceName" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL DEFAULT 'baileys',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "phoneNumber" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_tenantId_key" ON "app"."whatsapp_connections"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_instanceName_key" ON "app"."whatsapp_connections"("instanceName");

-- AddForeignKey
ALTER TABLE "app"."whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
