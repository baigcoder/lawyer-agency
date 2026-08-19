-- AlterTable
ALTER TABLE "app"."documents" ADD COLUMN     "description" TEXT,
ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "app"."document_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_chunks_tenantId_documentId_idx" ON "app"."document_chunks"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "documents_tenantId_isPinned_idx" ON "app"."documents"("tenantId", "isPinned");

-- AddForeignKey
ALTER TABLE "app"."document_chunks" ADD CONSTRAINT "document_chunks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "app"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
