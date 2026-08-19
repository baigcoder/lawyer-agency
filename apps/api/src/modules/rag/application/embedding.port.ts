import { DomainError } from '../../../common/errors/domain-error';

/**
 * Embedding generation port (Phase 8). Produces a normalized vector for a
 * text input. The dimension is fixed by the model (text-embedding-3-large
 * = 1536) and matched by the pgvector column.
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
