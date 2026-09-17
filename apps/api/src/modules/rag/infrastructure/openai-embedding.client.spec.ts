import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OpenAiEmbeddingClient, supportsDimensions } from './openai-embedding.client';
import { EmbeddingProviderError } from '../application/embedding.port';

function configFor(values: Record<string, unknown>): ConfigService<never, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
}

function stubFetch(vector: number[]) {
  const calls: Array<Record<string, unknown>> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body) as Record<string, unknown>);
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: vector, index: 0 }], usage: { prompt_tokens: 4 } }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const baseConfig = {
  OPENAI_API_KEY: 'sk-test',
  OPENAI_EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
  EMBEDDING_DIMENSIONS: 1536,
};

describe('supportsDimensions', () => {
  it('is true only for the v3 models that accept the override', () => {
    expect(supportsDimensions('text-embedding-3-large')).toBe(true);
    expect(supportsDimensions('text-embedding-3-small')).toBe(true);
    expect(supportsDimensions('text-embedding-ada-002')).toBe(false);
  });
});

describe('OpenAiEmbeddingClient', () => {
  it('asks for the dimension the vector column actually has', async () => {
    const stub = stubFetch(new Array(1536).fill(0.1));
    try {
      const client = new OpenAiEmbeddingClient(configFor(baseConfig));
      await client.embed('what documents are needed for bail?');
      // text-embedding-3-large defaults to 3072, which vector(1536) rejects.
      expect(stub.calls[0]).toMatchObject({ dimensions: 1536 });
    } finally {
      stub.restore();
    }
  });

  it('omits `dimensions` for a model that would reject it', async () => {
    const stub = stubFetch(new Array(1536).fill(0.1));
    try {
      const client = new OpenAiEmbeddingClient(
        configFor({ ...baseConfig, OPENAI_EMBEDDING_MODEL: 'text-embedding-ada-002' }),
      );
      await client.embed('hello');
      expect(stub.calls[0]).not.toHaveProperty('dimensions');
    } finally {
      stub.restore();
    }
  });

  it('reports a dimension mismatch clearly instead of failing inside raw SQL', async () => {
    const stub = stubFetch(new Array(3072).fill(0.1));
    try {
      const client = new OpenAiEmbeddingClient(configFor(baseConfig));
      await expect(client.embed('hello')).rejects.toThrow(EmbeddingProviderError);
      await expect(client.embed('hello')).rejects.toThrow(/3072 dimensions but the vector column expects 1536/);
    } finally {
      stub.restore();
    }
  });
});
