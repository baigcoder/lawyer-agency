import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { chunkText } from '../../rag/application/chunking.service';
import { EMBEDDING_CLIENT, type EmbeddingClient } from '../../rag/application/embedding.port';
import { OBJECT_STORAGE, type ObjectStorage } from '../../whatsapp/application/ports';
import { DocumentExtractor } from '../infrastructure/document-extractor';
import type { DocType } from '../../../generated/prisma/client';

export interface UploadDocumentInput {
  tenantId: string;
  clientId: string;
  caseId?: string | undefined;
  messageId?: string | undefined;
  filename: string;
  description?: string | undefined;
  docType: DocType;
  buffer: Buffer;
  mimeType: string;
}

export interface ClientFolderSummary {
  id: string;
  name: string | null;
  waPhone: string;
  documentCount: number;
}

export interface DocumentRecord {
  id: string;
  clientId: string;
  caseId: string | null;
  messageId: string | null;
  storagePath: string;
  filename: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  docType: DocType;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  isPinned: boolean;
  createdAt: Date;
}

/** Map inbound WhatsApp media to a firm document type. */
export function inferInboundDocType(
  mimeType: string,
  filename: string,
  contentType: 'IMAGE' | 'DOCUMENT',
): DocType {
  if (contentType === 'IMAGE') return 'EVIDENCE_PHOTO';
  const lower = filename.toLowerCase();
  if (lower.includes('cnic') || lower.includes('id_card') || lower.includes('nic')) return 'CNIC';
  if (lower.includes('fir')) return 'FIR';
  if (lower.includes('notice') || lower.includes('court')) return 'COURT_NOTICE';
  if (lower.includes('affidavit')) return 'AFFIDAVIT';
  if (lower.includes('contract') || lower.includes('agreement')) return 'CONTRACT';
  if (mimeType.includes('pdf')) return 'OTHER';
  return 'OTHER';
}

/**
 * Documents — tenant-scoped upload, storage, text extraction, and RAG indexing.
 * Owns: documents, document_chunks. Consumes: object storage, embedding client.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
    private readonly extractor: DocumentExtractor,
  ) {}

  async upload(input: UploadDocumentInput): Promise<DocumentRecord> {
    return this.uow.withTenant(input.tenantId, async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { name: true } });
      const clientFolder = (client?.name ?? 'unknown').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
      const caseFolder = input.caseId ?? 'general';
      const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${input.tenantId}/${clientFolder}-${input.clientId}/${caseFolder}/${Date.now()}-${safeName}`;

      await this.storage.put(storagePath, input.buffer);

      const extraction = await this.extractor.extract(input.buffer, input.mimeType, input.filename);
      const chunks = extraction.text ? chunkText(extraction.text, { targetTokens: 400, overlapTokens: 80 }) : [];

      const document = await tx.document.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          caseId: input.caseId ?? null,
          messageId: input.messageId ?? null,
          storagePath,
          filename: input.filename,
          description: input.description ?? null,
          mimeType: input.mimeType,
          sizeBytes: input.buffer.length,
          docType: input.docType,
          ocrStatus: extraction.text ? 'COMPLETED' : 'SKIPPED',
          ocrConfidence: extraction.confidence,
          extractedText: extraction.text || null,
        },
      });

      if (chunks.length > 0) {
        const embeddings = await this.embeddings.embedBatch(chunks.map((c) => c.content));
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];
          if (!chunk || !embedding) continue;
          const vectorSql = `[${embedding.vector.join(',')}]`;
          await tx.$executeRaw`
            INSERT INTO app.document_chunks ("id", "tenantId", "documentId", "chunkIndex", "content", "tokenCount", "embedding", "metadata")
            VALUES (
              gen_random_uuid(),
              ${input.tenantId}::uuid,
              ${document.id}::uuid,
              ${chunk.chunkIndex},
              ${chunk.content},
              ${chunk.tokenCount},
              ${vectorSql}::vector(1536),
              '{}'::jsonb
            )`;
        }
      }

      return {
        id: document.id,
        clientId: document.clientId,
        caseId: document.caseId,
        messageId: document.messageId,
        storagePath: document.storagePath,
        filename: document.filename,
        description: document.description,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        docType: document.docType,
        ocrStatus: document.ocrStatus,
        isPinned: document.isPinned,
        createdAt: document.createdAt,
      };
    });
  }

  async listClients(tenantId: string): Promise<ClientFolderSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.client.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          waPhone: true,
          _count: { select: { documents: { where: { deletedAt: null } } } },
        },
      });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        waPhone: c.waPhone,
        documentCount: c._count.documents,
      }));
    });
  }

  async listForClient(tenantId: string, clientId: string): Promise<DocumentRecord[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.document.findMany({
        where: { clientId, deletedAt: null },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map((d) => this.mapRecord(d));
    });
  }

  async listForCase(tenantId: string, caseId: string): Promise<DocumentRecord[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.document.findMany({
        where: { caseId, deletedAt: null },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map((d) => this.mapRecord(d));
    });
  }

  async togglePin(tenantId: string, documentId: string, isPinned: boolean): Promise<DocumentRecord> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const updated = await tx.document.update({
        where: { id: documentId },
        data: { isPinned },
      });
      return this.mapRecord(updated);
    });
  }

  private mapRecord(d: {
    id: string;
    clientId: string;
    caseId: string | null;
    messageId?: string | null;
    storagePath?: string;
    filename: string;
    description: string | null;
    mimeType: string;
    sizeBytes: number;
    docType: DocType;
    ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    isPinned: boolean;
    createdAt: Date;
  }): DocumentRecord {
    return {
      id: d.id,
      clientId: d.clientId,
      caseId: d.caseId,
      messageId: d.messageId ?? null,
      storagePath: d.storagePath ?? '',
      filename: d.filename,
      description: d.description,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      docType: d.docType,
      ocrStatus: d.ocrStatus,
      isPinned: d.isPinned,
      createdAt: d.createdAt,
    };
  }
}
