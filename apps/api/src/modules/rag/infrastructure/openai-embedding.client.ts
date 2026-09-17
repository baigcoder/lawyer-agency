import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import {
  EmbeddingProviderError,
  type EmbeddingClient,
  type EmbeddingResult,
} from '../application/embedding.port';

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number };
}

/**
 * OpenAI embeddings adapter (native fetch, no SDK). Batch-friendly for the
 * chunking pipeline; normalizes vectors to unit length for cosine similarity.
 */
@Injectable()
export class OpenAiEmbeddingClient implements EmbeddingClient {
  private readonly logger = new Logger(OpenAiEmbeddingClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    const result = results[0];
    if (!result) throw new EmbeddingProviderError('empty embedding response');
    return result;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (!apiKey) throw new EmbeddingProviderError('OPENAI_API_KEY not configured');

    const baseUrl = this.config.get('OPENAI_EMBEDDING_BASE_URL', { infer: true }).replace(/\/$/, '');
    const model = this.config.get('OPENAI_EMBEDDING_MODEL', { infer: true });
    const dimensions = this.config.get('EMBEDDING_DIMENSIONS', { infer: true });
    const inputs = texts.map((t) => t.replace(/\n/g, ' '));

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      // `dimensions` is not optional here: the pgvector columns are
      // vector(1536), while text-embedding-3-large returns 3072 by default.
      // Without it Postgres rejects every insert and every search with
      // "expected 1536 dimensions, not 3072".
      body: JSON.stringify({ model, input: inputs, ...(supportsDimensions(model) ? { dimensions } : {}) }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      this.logger.warn({ status: response.status }, 'embedding request failed');
      throw new EmbeddingProviderError(`HTTP ${response.status}: ${text}`);
    }

    const body = (await response.json()) as OpenAiEmbeddingResponse;
    const data = body.data ?? [];
    const tokensPerInput = Math.ceil((body.usage?.prompt_tokens ?? 0) / texts.length) || 0;
    const vectors = data
      .sort((a, b) => a.index - b.index)
      .map((d) => ({ vector: normalize(d.embedding), tokensUsed: tokensPerInput }));

    const wrong = vectors.find((v) => v.vector.length !== dimensions);
    if (wrong) {
      // Fail here with a readable message rather than deep inside a raw SQL
      // insert, where the error surfaces as an opaque Postgres cast failure.
      throw new EmbeddingProviderError(
        `model ${model} returned ${wrong.vector.length} dimensions but the vector column expects ${dimensions}`,
      );
    }
    return vectors;
  }
}

/**
 * Only the v3 models accept a `dimensions` override; sending it to an older
 * model (or a non-OpenAI gateway) is a 400.
 */
export function supportsDimensions(model: string): boolean {
  return /^text-embedding-3-/.test(model);
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}
