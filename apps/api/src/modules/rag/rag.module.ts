import { Module } from '@nestjs/common';
import { RETRIEVER } from './application/retriever.port';
import { EMBEDDING_CLIENT } from './application/embedding.port';
import { VectorRetriever } from './infrastructure/vector-retriever';
import { SimpleRetriever } from './infrastructure/simple-retriever';
import { ResilientRetriever } from './infrastructure/resilient-retriever';
import { OpenAiEmbeddingClient } from './infrastructure/openai-embedding.client';
import { KnowledgeBaseService } from './application/knowledge-base.service';
import { PakistanKbSeedService } from './application/pakistan-kb-seed.service';
import { KnowledgeBaseController } from './interface/knowledge-base.controller';

/**
 * RAG — knowledge base management, chunking/embedding pipeline, tenant-
 * scoped vector retrieval (tenantId filter + RLS, FR-KB-02), citations.
 * Owns: knowledge_base, kb_chunks. Publishes: kb.indexed.
 * Consumes: Documents (source files). Built in: Phase 8.
 */
@Module({
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    PakistanKbSeedService,
    { provide: EMBEDDING_CLIENT, useClass: OpenAiEmbeddingClient },
    VectorRetriever,
    SimpleRetriever,
    ResilientRetriever,
    { provide: RETRIEVER, useClass: ResilientRetriever },
  ],
  exports: [RETRIEVER, EMBEDDING_CLIENT, KnowledgeBaseService, PakistanKbSeedService],
})
export class RagModule {}
