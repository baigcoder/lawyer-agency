import { DomainError } from '../../../common/errors/domain-error';

/**
 * Embedding generation port (Phase 8). Produces a normalized vector for a
 * text input. The dimension (EMBEDDING_DIMENSIONS, 384 for the default local
 * multilingual-e5-small) must match the pgvector columns.
 *
 * `embed` is for a search query and `embedBatch` for documents being indexed.
 * The distinction matters: instruction-tuned models such as e5 embed the two
 * differently and retrieve worse when they are mixed up.
 */

export interface EmbeddingResult {
  vector: number[];
  tokensUsed: number;
}

export interface EmbeddingClient {
  embed(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}

export class EmbeddingProviderError extends DomainError {
  readonly httpStatus = 502;

  constructor(message: string) {
    super(`Embedding provider error: ${message}`);
    this.name = 'EmbeddingProviderError';
  }
}

export const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');
