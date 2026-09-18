import { describe, expect, it, vi } from 'vitest';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingProviderError, type EmbeddingClient } from './embedding.port';
import type { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { OutboxWriter } from '../../../common/events/outbox-writer';

interface Insert {
  sql: string;
  values: unknown[];
}

/** Harness written without vi.mocked, which the bun runner does not provide. */
function makeService(embeddings: EmbeddingClient, rawRows: unknown[] = []) {
  const inserts: Insert[] = [];
  const tx = {
    knowledgeBase: {
      create: vi.fn(async (args: { data: { title: string; content: string } }) => ({ id: 'kb-1', ...args.data })),
      findFirst: vi.fn(async () => ({ id: 'kb-1', title: 'Fees', content: 'Consultation fee is payable in advance.' })),
      update: vi.fn(async () => ({ id: 'kb-1' })),
      findMany: vi.fn(async () => []),
    },
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('INSERT')) inserts.push({ sql, values });
      return 0;
    }),
    $queryRaw: vi.fn(async () => rawRows),
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const outbox = { append: vi.fn(async () => {}) } as unknown as OutboxWriter;
  return { service: new KnowledgeBaseService(uow, embeddings, outbox), inserts };
}

const failing: EmbeddingClient = {
  embed: async () => {
    throw new EmbeddingProviderError('provider unavailable');
  },
  embedBatch: async () => {
    throw new EmbeddingProviderError('provider unavailable');
  },
};

const working: EmbeddingClient = {
  embed: async () => ({ vector: [0.6, 0.8], tokensUsed: 1 }),
  embedBatch: async (texts) => texts.map(() => ({ vector: [0.6, 0.8], tokensUsed: 1 })),
};

const entry = { tenantId: 't1', title: 'Fees', content: 'Consultation fee is payable in advance.', language: 'en' };

describe('KnowledgeBaseService indexing', () => {
  it('stores NULL — never a zero vector — when embeddings are unavailable', async () => {
    const { service, inserts } = makeService(failing);
    await service.create(entry);

    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) {
      // A zero vector counted as "embedded", sat in the HNSW index and scored
      // identically against every query. NULL is what VectorRetriever skips.
      expect(insert.sql).toContain('NULL');
      expect(insert.sql).not.toContain('::vector');
      expect(insert.values.some((v) => typeof v === 'string' && /^\[0(,0)*\]$/.test(v))).toBe(false);
    }
  });

  it('still keeps the chunk text, so keyword search can find it', async () => {
    const { service, inserts } = makeService(failing);
    await service.create(entry);
    expect(inserts[0]?.values).toContain(entry.content);
  });

  it('stores the real vector when embeddings work', async () => {
    const { service, inserts } = makeService(working);
    await service.create(entry);
    expect(inserts[0]?.sql).toContain('::vector');
    expect(inserts[0]?.values).toContain('[0.6,0.8]');
  });
});

describe('KnowledgeBaseService.embeddingCoverage', () => {
  it('reports how much of the KB semantic search cannot see', async () => {
    const { service } = makeService(working, [{ chunks: 38n, embedded: 0n }]);
    await expect(service.embeddingCoverage('t1')).resolves.toEqual({ chunks: 38, embedded: 0, missing: 38 });
  });

  it('reports nothing missing once every chunk has a vector', async () => {
    const { service } = makeService(working, [{ chunks: 38n, embedded: 38n }]);
    await expect(service.embeddingCoverage('t1')).resolves.toEqual({ chunks: 38, embedded: 38, missing: 0 });
  });
});

describe('KnowledgeBaseService.reindexMissingEmbeddings', () => {
  it('re-embeds every entry that has chunks without a vector', async () => {
    const { service, inserts } = makeService(working, [{ kbId: 'kb-1' }]);
    await expect(service.reindexMissingEmbeddings('t1')).resolves.toEqual({ entries: 1, chunks: 1 });
    expect(inserts[0]?.sql).toContain('::vector');
  });

  it('does nothing when the knowledge base is already fully embedded', async () => {
    const { service, inserts } = makeService(working, []);
    await expect(service.reindexMissingEmbeddings('t1')).resolves.toEqual({ entries: 0, chunks: 0 });
    expect(inserts).toHaveLength(0);
  });
});
