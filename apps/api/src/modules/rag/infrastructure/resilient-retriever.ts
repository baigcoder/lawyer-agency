import { Injectable, Logger } from '@nestjs/common';
import type { Retriever, RetrievedChunk } from '../application/retriever.port';
import { EmbeddingProviderError } from '../application/embedding.port';
import { SimpleRetriever } from './simple-retriever';
import { VectorRetriever } from './vector-retriever';

/**
 * Vector search when embeddings are configured; keyword search otherwise.
 * Groq (and other chat-only providers) do not expose embedding models — without
 * this fallback the entire AI reply pipeline would fail before the first send.
 */
@Injectable()
export class ResilientRetriever implements Retriever {
  private readonly logger = new Logger(ResilientRetriever.name);

  constructor(
    private readonly vector: VectorRetriever,
    private readonly keyword: SimpleRetriever,
  ) {}

  async search(params: {
    tenantId: string;
    query: string;
    language: string;
    topK?: number;
    clientId?: string;
    caseId?: string;
  }): Promise<RetrievedChunk[]> {
    try {
      return await this.vector.search(params);
    } catch (error) {
      if (error instanceof EmbeddingProviderError) {
        this.logger.warn(
          { tenantId: params.tenantId, reason: error.message.slice(0, 200) },
          'embedding search unavailable — falling back to keyword retrieval',
        );
        return this.keyword.search(params);
      }
      throw error;
    }
  }
}
