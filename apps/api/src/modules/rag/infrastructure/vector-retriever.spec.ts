import { describe, expect, it, vi } from 'vitest';
import { VectorRetriever } from './vector-retriever';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { EmbeddingClient } from '../application/embedding.port';

function makeRetriever(overrides: { rows?: unknown[] } = {}) {
  const tx = {
    $queryRaw: vi.fn(async () => overrides.rows ?? []),
  };
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const embeddings: EmbeddingClient = {
    embed: vi.fn(async () => ({ vector: [0.1, 0.2, 0.3], tokensUsed: 1 })),
    embedBatch: vi.fn(),
  };
  const config = { get: () => 'text-embedding-3-large' } as never;
  return { retriever: new VectorRetriever(uow, embeddings, config), tx, embeddings };
}

describe('VectorRetriever', () => {
  it('embeds the query and runs tenant-scoped vector search', async () => {
    const { retriever, tx, embeddings } = makeRetriever({
      rows: [{ id: 'chunk-1', kbId: 'kb-1', content: 'relevant', title: 'Tenant Rights', score: 0.91 }],
    });
    const results = await retriever.search({ tenantId: 't1', query: 'tenant rights', language: 'EN' });
    expect(embeddings.embed).toHaveBeenCalledWith('tenant rights');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ chunkId: 'chunk-1', kbId: 'kb-1', title: 'Tenant Rights', source: 'knowledge_base' });
  });
});
