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

  /** A search query — the text a client typed. */
  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.request([text], 'query');
    const result = results[0];
    if (!result) throw new EmbeddingProviderError('empty embedding response');
    return result;
  }

  /** Documents being indexed — knowledge-base articles and client files. */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return this.request(texts, 'passage');
  }

  private async request(texts: string[], kind: EmbeddingKind): Promise<EmbeddingResult[]> {
    const baseUrl = this.config.get('OPENAI_EMBEDDING_BASE_URL', { infer: true }).replace(/\/$/, '');
    const apiKey = resolveEmbeddingKey({
      baseUrl,
      embeddingKey: this.config.get('OPENAI_EMBEDDING_API_KEY', { infer: true }),
      chatKey: this.config.get('OPENAI_API_KEY', { infer: true }),
    });

    if (!apiKey && isHostedOpenAi(baseUrl)) {
      throw new EmbeddingProviderError('no embedding key: set OPENAI_EMBEDDING_API_KEY (or OPENAI_API_KEY)');
    }
    const mismatch = apiKey ? describeKeyMismatch(apiKey, baseUrl) : null;
    if (mismatch) throw new EmbeddingProviderError(mismatch);

    const model = this.config.get('OPENAI_EMBEDDING_MODEL', { infer: true });
    const dimensions = this.config.get('EMBEDDING_DIMENSIONS', { infer: true });
    const inputs = texts.map((t) => withInstructionPrefix(model, kind, t.replace(/\n/g, ' ')));

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
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

export type EmbeddingKind = 'query' | 'passage';

export function isHostedOpenAi(baseUrl: string): boolean {
  return /(^|\/\/)api\.openai\.com/.test(baseUrl);
}

/**
 * Which key, if any, to send to the embedding endpoint.
 *
 * An explicit OPENAI_EMBEDDING_API_KEY is always used — it was set for this.
 * The chat key (OPENAI_API_KEY) is only borrowed for OpenAI's own endpoint.
 * Forwarding it to a local or third-party embedding server would hand a secret
 * — often a Groq key — to a service it was never issued for.
 */
export function resolveEmbeddingKey(input: {
  baseUrl: string;
  embeddingKey: string | undefined;
  chatKey: string | undefined;
}): string | undefined {
  if (input.embeddingKey) return input.embeddingKey;
  return isHostedOpenAi(input.baseUrl) ? input.chatKey : undefined;
}

/**
 * The e5 family is trained with instruction prefixes and scores noticeably
 * worse without them: a query must read "query: …" and an indexed document
 * "passage: …". Other models take text as-is.
 */
export function withInstructionPrefix(model: string, kind: EmbeddingKind, text: string): string {
  if (!/(^|\/)(multilingual-)?e5[-_]/i.test(model)) return text;
  return `${kind}: ${text}`;
}

/**
 * A Groq key sent to OpenAI's embeddings endpoint can only ever 401. That is
 * the natural result of pointing OPENAI_API_KEY at Groq for chat, and it used to
 * fail on every knowledge-base write with a generic auth error — so name the
 * cause instead of making someone decode it.
 */
export function describeKeyMismatch(apiKey: string, baseUrl: string): string | null {
  const isGroqKey = apiKey.startsWith('gsk_');
  const isOpenAiEndpoint = /(^|\/\/)api\.openai\.com/.test(baseUrl);
  if (isGroqKey && isOpenAiEndpoint) {
    return (
      'the embedding key is a Groq key (gsk_…) but OPENAI_EMBEDDING_BASE_URL is OpenAI, and Groq has no ' +
      'embeddings endpoint. Set OPENAI_EMBEDDING_API_KEY to an OpenAI key (sk-…).'
    );
  }
  return null;
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
