import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Retriever, RetrievedChunk } from '../application/retriever.port';

/**
 * Dev RAG stand-in: keyword search over `app.kb_chunks` and `app.document_chunks`.
 * Phase 8 replaces this with pgvector similarity search and embeddings generation.
 */
@Injectable()
export class SimpleRetriever implements Retriever {
  constructor(private readonly uow: UnitOfWork) {}

  async search(params: {
    tenantId: string;
    query: string;
    language: string;
    topK?: number;
    clientId?: string;
    caseId?: string;
  }): Promise<RetrievedChunk[]> {
    const topK = params.topK ?? 6;
    const patterns = buildKeywordPatterns(params.query);
    if (patterns.length === 0) return [];

    return this.uow.withTenant(params.tenantId, async (tx) => {
      const kbRows = await tx.$queryRaw<
        Array<{ id: string; kbId: string; content: string; title: string }>
      >`
        SELECT c.id, c."kbId", c.content, k.title
        FROM app.kb_chunks c
        JOIN app.knowledge_base k ON k.id = c."kbId"
        WHERE c."tenantId" = ${params.tenantId}::uuid
          AND k.status = 'PUBLISHED'
          AND c.content ILIKE ANY(${patterns}::text[])
        ORDER BY c."chunkIndex"
        LIMIT ${topK}`;

      const kbChunks: RetrievedChunk[] = kbRows.map((r) => ({
        chunkId: r.id,
        content: r.content,
        score: 0.5,
        source: 'knowledge_base',
        kbId: r.kbId,
        title: r.title,
      }));

      if (!params.clientId && !params.caseId) {
        return kbChunks;
      }

      const docRows = await tx.$queryRaw<
        Array<{ id: string; documentId: string; content: string; filename: string }>
      >`
        SELECT c.id, c."documentId", c.content, d.filename
        FROM app.document_chunks c
        JOIN app.documents d ON d.id = c."documentId"
        WHERE c."tenantId" = ${params.tenantId}::uuid
          AND c.content ILIKE ANY(${patterns}::text[])
          AND (
            ${params.clientId ?? null}::uuid IS NULL OR d."clientId" = ${params.clientId ?? null}::uuid
          )
          AND (
            ${params.caseId ?? null}::uuid IS NULL OR d."caseId" = ${params.caseId ?? null}::uuid OR d."caseId" IS NULL
          )
        ORDER BY c."chunkIndex"
        LIMIT ${topK}`;

      const docChunks: RetrievedChunk[] = docRows.map((r) => ({
        chunkId: r.id,
        content: r.content,
        score: 0.5,
        source: 'document',
        documentId: r.documentId,
        title: r.filename,
      }));

      return [...kbChunks, ...docChunks].slice(0, topK);
    });
  }
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'are',
  'do',
  'for',
  'how',
  'i',
  'is',
  'me',
  'of',
  'the',
  'to',
  'what',
  'which',
]);

export function buildKeywordPatterns(query: string): string[] {
  const terms = query
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
  return [...new Set(terms ?? [])].slice(0, 12).map((term) => `%${term}%`);
}
