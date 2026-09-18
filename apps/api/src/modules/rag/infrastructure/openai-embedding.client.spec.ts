import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  describeKeyMismatch,
  OpenAiEmbeddingClient,
  resolveEmbeddingKey,
  supportsDimensions,
  withInstructionPrefix,
} from './openai-embedding.client';
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

describe('resolveEmbeddingKey', () => {
  it('always uses a key set specifically for embeddings', () => {
    expect(resolveEmbeddingKey({ baseUrl: 'http://embeddings:80/v1', embeddingKey: 'sk-emb', chatKey: 'gsk_chat' })).toBe('sk-emb');
  });

  it('borrows the chat key only for OpenAI itself', () => {
    expect(resolveEmbeddingKey({ baseUrl: 'https://api.openai.com/v1', embeddingKey: undefined, chatKey: 'sk-chat' })).toBe('sk-chat');
  });

  it('never forwards the chat key to a local or third-party server', () => {
    // Often a Groq key — handing it to an unrelated service leaks a secret.
    expect(resolveEmbeddingKey({ baseUrl: 'http://embeddings:80/v1', embeddingKey: undefined, chatKey: 'gsk_chat' })).toBeUndefined();
  });
});

describe('withInstructionPrefix', () => {
  it('prefixes e5 queries and passages differently, as the model was trained', () => {
    expect(withInstructionPrefix('intfloat/multilingual-e5-small', 'query', 'khula case')).toBe('query: khula case');
    expect(withInstructionPrefix('intfloat/multilingual-e5-small', 'passage', 'Khula is…')).toBe('passage: Khula is…');
  });

  it('leaves models that take plain text alone', () => {
    expect(withInstructionPrefix('text-embedding-3-small', 'query', 'khula case')).toBe('khula case');
  });
});

describe('describeKeyMismatch', () => {
  it('names the exact misconfiguration of a Groq key against OpenAI embeddings', () => {
    expect(describeKeyMismatch('gsk_abc', 'https://api.openai.com/v1')).toMatch(/Groq key/);
  });

  it('allows a real OpenAI key, and any key against a local server', () => {
    expect(describeKeyMismatch('sk-abc', 'https://api.openai.com/v1')).toBeNull();
    expect(describeKeyMismatch('gsk_abc', 'http://embeddings:80/v1')).toBeNull();
  });
});

describe('OpenAiEmbeddingClient against a local server', () => {
  it('works with no API key and sends the e5 query prefix', async () => {
    const seen: Array<{ auth: string | null; input: string[] }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { body: string; headers: Record<string, string> }) => {
      seen.push({ auth: init.headers['authorization'] ?? null, input: (JSON.parse(init.body) as { input: string[] }).input });
      return { ok: true, json: async () => ({ data: [{ embedding: new Array(384).fill(0.05), index: 0 }], usage: { prompt_tokens: 3 } }) } as unknown as Response;
    }) as typeof globalThis.fetch;
    try {
      const client = new OpenAiEmbeddingClient(
        configFor({
          OPENAI_API_KEY: 'gsk_chat_key',
          OPENAI_EMBEDDING_BASE_URL: 'http://embeddings:80/v1',
          OPENAI_EMBEDDING_MODEL: 'intfloat/multilingual-e5-small',
          EMBEDDING_DIMENSIONS: 384,
        }),
      );
      await client.embed('meri behn ka khula ka case hai');
      expect(seen[0]?.auth).toBeNull();
      expect(seen[0]?.input[0]).toBe('query: meri behn ka khula ka case hai');
    } finally {
      globalThis.fetch = original;
    }
  });
});
