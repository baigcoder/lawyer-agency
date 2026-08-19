import { describe, expect, it, vi } from 'vitest';
import { DocumentsService, inferInboundDocType } from './documents.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DocumentExtractor } from '../infrastructure/document-extractor';
import type { ObjectStorage } from '../../whatsapp/application/ports';
import type { EmbeddingClient } from '../../rag/application/embedding.port';

function makeService(overrides: { extractedText?: string } = {}) {
  const storage: ObjectStorage = {
    put: vi.fn(async (path) => ({ path })),
    get: vi.fn(async () => Buffer.from('')),
    getUrl: vi.fn((path) => `file://${path}`),
  };
  const embeddings: EmbeddingClient = {
    embed: vi.fn(async () => ({ vector: Array(1536).fill(0.1), tokensUsed: 1 })),
    embedBatch: vi.fn(async (texts) => texts.map(() => ({ vector: Array(1536).fill(0.1), tokensUsed: 1 }))),
  };
  const extractor: DocumentExtractor = {
    extract: vi.fn(async () => ({ text: overrides.extractedText ?? 'extracted text content', confidence: 0.95 })),
  };
  const created: Record<string, unknown> = {};
  const tx = {
    client: { findUnique: vi.fn(async () => ({ name: 'Asma Khan' })) },
    document: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        Object.assign(created, args.data);
        return { id: 'doc-1', ...args.data };
      }),
    },
    $executeRaw: vi.fn(async () => 0),
  };
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;

  return { service: new DocumentsService(uow, storage, embeddings, extractor), storage, embeddings, extractor, created, tx };
}

describe('DocumentsService.upload', () => {
  it('stores file, extracts text, chunks, and creates document row', async () => {
    const { service, storage, extractor, created, tx } = makeService();
    const result = await service.upload({
      tenantId: 't1',
      clientId: 'client-1',
      filename: 'contract.pdf',
      description: 'Client contract',
      docType: 'CONTRACT',
      buffer: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
    });

    expect(storage.put).toHaveBeenCalledWith(expect.stringContaining('contract.pdf'), Buffer.from('pdf-bytes'));
    expect(extractor.extract).toHaveBeenCalledWith(Buffer.from('pdf-bytes'), 'application/pdf', 'contract.pdf');
    expect(result.id).toBe('doc-1');
    expect(result.filename).toBe('contract.pdf');
    expect(created['docType']).toBe('CONTRACT');
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('persists messageId provenance when provided', async () => {
    const { service, created } = makeService();
    await service.upload({
      tenantId: 't1',
      clientId: 'client-1',
      messageId: 'msg-1',
      filename: 'cnic.pdf',
      docType: 'CNIC',
      buffer: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
    });
    expect(created['messageId']).toBe('msg-1');
  });

  it('skips chunking when no text is extracted', async () => {
    const { service, tx } = makeService({ extractedText: '' });
    await service.upload({
      tenantId: 't1',
      clientId: 'client-1',
      filename: 'scan.jpg',
      docType: 'EVIDENCE_PHOTO',
      buffer: Buffer.from('image-bytes'),
      mimeType: 'image/jpeg',
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('inferInboundDocType', () => {
  it('classifies images as evidence photos', () => {
    expect(inferInboundDocType('image/jpeg', 'photo.jpg', 'IMAGE')).toBe('EVIDENCE_PHOTO');
  });

  it('detects CNIC from filename', () => {
    expect(inferInboundDocType('application/pdf', 'client_cnic.pdf', 'DOCUMENT')).toBe('CNIC');
  });
});
