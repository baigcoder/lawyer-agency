import { describe, expect, it, vi } from 'vitest';
import { EmbeddingProviderError } from '../application/embedding.port';
import { ResilientRetriever } from './resilient-retriever';
import type { VectorRetriever } from './vector-retriever';
import type { SimpleRetriever } from './simple-retriever';

describe('ResilientRetriever', () => {
  it('returns vector results when embedding search succeeds', async () => {
    const vector = {
      search: vi.fn(async () => [{ chunkId: 'c1', content: 'vector hit', score: 0.9, source: 'knowledge_base' as const }]),
    } as unknown as VectorRetriever;
    const keyword = { search: vi.fn(async () => []) } as unknown as SimpleRetriever;
    const retriever = new ResilientRetriever(vector, keyword);

    const chunks = await retriever.search({ tenantId: 't1', query: 'family law', language: 'EN' });
    expect(chunks[0]?.content).toBe('vector hit');
    expect(keyword.search).not.toHaveBeenCalled();
  });

  it('falls back to keyword search when embeddings fail', async () => {
    const vector = {
      search: vi.fn(async () => {
        throw new EmbeddingProviderError('HTTP 404: model_not_found');
      }),
    } as unknown as VectorRetriever;
    const keyword = {
      search: vi.fn(async () => [{ chunkId: 'k2', content: 'keyword hit', score: 0.5, source: 'knowledge_base' as const }]),
    } as unknown as SimpleRetriever;
    const retriever = new ResilientRetriever(vector, keyword);

    const chunks = await retriever.search({ tenantId: 't1', query: 'family law', language: 'EN' });
    expect(chunks[0]?.content).toBe('keyword hit');
    expect(keyword.search).toHaveBeenCalled();
  });
});
