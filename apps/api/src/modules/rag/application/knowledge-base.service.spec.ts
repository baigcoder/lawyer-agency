import { describe, expect, it, vi } from 'vitest';
import { KnowledgeBaseService } from './knowledge-base.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { EmbeddingProviderError, type EmbeddingClient } from './embedding.port';

function makeService() {
  const captured: { deletes: number; inserts: Array<{ chunkIndex: number; content: string }> } = { deletes: 0, inserts: [] };
  const tx = {
    knowledgeBase: {
      create: vi.fn(async (args: { data: { title: string; content: string } }) => ({ id: 'kb-1', ...args.data })),
      findFirst: vi.fn(async () => ({ id: 'kb-1', title: 't', content: 'c' })),
      update: vi.fn(async (args: { data: { title?: string; content?: string } }) => ({ id: 'kb-1', ...args.data })),
      findMany: vi.fn(async () => []),
    },
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('DELETE')) captured.deletes++;
      if (sql.includes('INSERT')) {
        const chunkIndex = values[2] as number;
        const content = values[3] as string;
        captured.inserts.push({ chunkIndex, content });
      }
      return 0;
    }),
  };
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const embeddings: EmbeddingClient = {
    embed: vi.fn(async () => ({ vector: [0.1, 0.2], tokensUsed: 1 })),
    embedBatch: vi.fn(async (texts) => texts.map(() => ({ vector: [0.1, 0.2], tokensUsed: 1 }))),
  };
  const outbox = { append: vi.fn(async () => {}) } as unknown as OutboxWriter;
  return { service: new KnowledgeBaseService(uow, embeddings, outbox), tx, embeddings, captured, outbox };
}

describe('KnowledgeBaseService', () => {
  it('creates a KB entry, chunks it, and emits kb.indexed', async () => {
    const { service, tx, captured, outbox } = makeService();
    const result = await service.create({
      tenantId: 't1',
      title: 'Tenant Rights',
      content: 'First paragraph.\n\nSecond paragraph with more detail.',
      language: 'en',
    });
    expect(result.title).toBe('Tenant Rights');
    expect(tx.knowledgeBase.create).toHaveBeenCalled();
    expect(captured.deletes).toBe(1);
    expect(captured.inserts.length).toBeGreaterThan(0);
    expect(outbox.append).toHaveBeenCalled();
  });

  it('publishes an entry', async () => {
    const { service, tx } = makeService();
    const result = await service.publish('t1', 'kb-1');
    expect(tx.knowledgeBase.update).toHaveBeenCalledWith({ where: { id: 'kb-1' }, data: { status: 'PUBLISHED' } });
    expect(result).not.toBeNull();
  });

  it('still indexes for keyword retrieval when embeddings are unavailable', async () => {
    const { service, embeddings, captured } = makeService();
    vi.mocked(embeddings.embedBatch).mockRejectedValueOnce(
      new EmbeddingProviderError('provider unavailable'),
    );

    await service.create({
      tenantId: 't1',
      title: 'FBR registration',
      content: 'CNIC, registered mobile number, email, and bank account certificate.',
      language: 'en',
    });

    expect(captured.inserts.length).toBeGreaterThan(0);
  });

  it('returns null when entry not found', async () => {
    const { service, tx } = makeService();
    (tx.knowledgeBase.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const result = await service.publish('t1', 'missing');
    expect(result).toBeNull();
  });
});
