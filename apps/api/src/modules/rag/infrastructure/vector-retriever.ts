import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Env } from '../../../config/env';
import type { Retriever, RetrievedChunk } from '../application/retriever.port';
import { EMBEDDING_CLIENT, type EmbeddingClient } from '../application/embedding.port';

/**
 * pgvector cosine-similarity retriever (Phase 8). Tenant-scoped and filters
 * to PUBLISHED knowledge base entries plus client/case-linked document chunks.
 * Returns chunks ordered by similarity.
 */
@Injectable()
export class VectorRetriever implements Retriever {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async search(params: {
    tenantId: string;
    query: string;
    language: string;
    topK?: number;
    clientId?: string;
    caseId?: string;
  }): Promise<RetrievedChunk[]> {
    const topK = params.topK ?? 6;
    const embedding = await this.embeddings.embed(params.query);
    const vectorSql = `[${embedding.vector.join(',')}]`;

    return this.uow.withTenant(params.tenantId, async (tx) => {
      const kbRows = await tx.$queryRaw<
        Array<{ id: string; kbId: string; content: string; title: string; score: number }>
      >`
        SELECT
          c.id,
          c."kbId",
          c.content,
          k.title,
          1 - (c.embedding <=> ${vectorSql}::vector) AS score
        FROM app.kb_chunks c
        JOIN app.knowledge_base k ON k.id = c."kbId"
        WHERE c."tenantId" = ${params.tenantId}::uuid
          AND k.status = 'PUBLISHED'
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${vectorSql}::vector
        LIMIT ${topK}`;

      const kbChunks: RetrievedChunk[] = kbRows.map((r) => ({
        chunkId: r.id,
        content: r.content,
        score: Number(r.score),
        source: 'knowledge_base',
        kbId: r.kbId,
        title: r.title,
      }));

      if (!params.clientId && !params.caseId) {
        return kbChunks;
      }

      const docRows = await tx.$queryRaw<
        Array<{ id: string; documentId: string; content: string; filename: string; isPinned: boolean; score: number }>
      >`
        SELECT
          c.id,
          c."documentId",
          c.content,
          d.filename,
          d."isPinned",
          (1 - (c.embedding <=> ${vectorSql}::vector)) + CASE WHEN d."isPinned" THEN 0.15 ELSE 0 END AS score
        FROM app.document_chunks c
        JOIN app.documents d ON d.id = c."documentId"
        WHERE c."tenantId" = ${params.tenantId}::uuid
          AND c.embedding IS NOT NULL
          AND (
            ${params.clientId ?? null}::uuid IS NULL OR d."clientId" = ${params.clientId ?? null}::uuid
          )
          AND (
            ${params.caseId ?? null}::uuid IS NULL OR d."caseId" = ${params.caseId ?? null}::uuid OR d."caseId" IS NULL
          )
        ORDER BY c.embedding <=> ${vectorSql}::vector
        LIMIT ${topK}`;

      const docChunks: RetrievedChunk[] = docRows.map((r) => ({
        chunkId: r.id,
        content: r.content,
        score: Number(r.score),
        source: 'document',
        documentId: r.documentId,
        title: r.filename,
      }));

      return [...kbChunks, ...docChunks]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    });
  }
}
