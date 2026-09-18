import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { Prisma } from '../../../generated/prisma/client';
import { Language } from '../../../generated/prisma/enums';
import {
  EMBEDDING_CLIENT,
  EmbeddingProviderError,
  type EmbeddingClient,
} from './embedding.port';
import { chunkText } from './chunking.service';

export interface CreateKbEntryInput {
  tenantId: string;
  title: string;
  content: string;
  language: string;
  category?: string | null | undefined;
}

export interface UpdateKbEntryInput {
  title?: string | undefined;
  content?: string | undefined;
  category?: string | null | undefined;
}

/**
 * Knowledge base management (Phase 8). Owns `knowledge_base` and `kb_chunks`.
 * Creating/updating content triggers chunking + embedding generation.
 */
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly uow: UnitOfWork,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
    private readonly outbox: OutboxWriter,
  ) {}

  async create(input: CreateKbEntryInput) {
    return this.uow.withTenant(input.tenantId, async (tx) => {
      const entry = await tx.knowledgeBase.create({
        data: {
          tenantId: input.tenantId,
          title: input.title,
          content: input.content,
          language: input.language.toUpperCase() as Language,
          category: input.category ?? null,
          status: 'DRAFT',
        },
      });
      const chunks = await this.rebuildChunks(tx, input.tenantId, entry.id, input.content);
      await this.outbox.append(tx, input.tenantId, DOMAIN_EVENTS.KbIndexed, {
        kbId: entry.id,
        tenantId: input.tenantId,
        chunkCount: chunks.length,
      });
      return entry;
    });
  }

  async update(tenantId: string, id: string, input: UpdateKbEntryInput) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.knowledgeBase.findFirst({ where: { id, tenantId } });
      if (!existing) return null;

      const content = input.content ?? existing.content;
      const entry = await tx.knowledgeBase.update({
        where: { id },
        data: {
          title: input.title ?? existing.title,
          content,
          category: input.category ?? existing.category,
        },
      });

      if (input.content !== undefined) {
        const chunks = await this.rebuildChunks(tx, tenantId, id, content);
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.KbIndexed, {
          kbId: id,
          tenantId,
          chunkCount: chunks.length,
        });
      }
      return entry;
    });
  }

  async publish(tenantId: string, id: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.knowledgeBase.findFirst({ where: { id, tenantId } });
      if (!existing) return null;
      return tx.knowledgeBase.update({ where: { id }, data: { status: 'PUBLISHED' } });
    });
  }

  async archive(tenantId: string, id: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.knowledgeBase.findFirst({ where: { id, tenantId } });
      if (!existing) return null;
      return tx.knowledgeBase.update({ where: { id }, data: { status: 'ARCHIVED' } });
    });
  }

  async list(tenantId: string, options: { status?: string | undefined } = {}) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const where: Prisma.KnowledgeBaseWhereInput = { tenantId };
      if (options.status !== undefined) {
        where.status = options.status as Prisma.EnumKbStatusFilter<'KnowledgeBase'>;
      }
      return tx.knowledgeBase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async get(tenantId: string, id: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.knowledgeBase.findFirst({ where: { id, tenantId } });
    });
  }

  private async rebuildChunks(tx: Prisma.TransactionClient, tenantId: string, kbId: string, content: string) {
    const chunks = chunkText(content);
    if (chunks.length === 0) return chunks;

    let embeddings: Array<{ vector: number[]; tokensUsed: number }> | null = null;
    try {
      embeddings = await this.embeddings.embedBatch(chunks.map((c) => c.content));
    } catch (error) {
      if (!(error instanceof EmbeddingProviderError)) throw error;
      // Store NULL, never a zero vector. A zero vector is indistinguishable
      // from a real embedding in `count(embedding)`, sits in the HNSW index,
      // and returns an identical distance for every query — so the knowledge
      // base looks indexed while semantic search silently returns noise.
      // NULL is honest: `VectorRetriever` skips those rows and keyword search
      // still finds them, and `countChunksMissingEmbeddings` can report it.
      this.logger.warn(
        { tenantId, kbId, chunks: chunks.length, reason: error.message.slice(0, 200) },
        'embedding unavailable — stored for keyword retrieval only; re-index once embeddings work',
      );
    }

    // Delete old chunks and insert new ones via raw SQL because Prisma does
    // not support the Unsupported("vector(1536)") column.
    await tx.$executeRaw`
      DELETE FROM app.kb_chunks WHERE "kbId" = ${kbId}::uuid`;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const vector = embeddings?.[i]?.vector;
      const metadata = JSON.stringify({ source: 'manual' });
      if (vector && vector.length > 0) {
        await tx.$executeRaw`
          INSERT INTO app.kb_chunks ("tenantId", "kbId", "chunkIndex", content, "tokenCount", embedding, metadata)
          VALUES (
            ${tenantId}::uuid,
            ${kbId}::uuid,
            ${chunk.chunkIndex},
            ${chunk.content},
            ${chunk.tokenCount},
            ${vectorToSql(vector)}::vector,
            ${metadata}::jsonb
          )`;
      } else {
        await tx.$executeRaw`
          INSERT INTO app.kb_chunks ("tenantId", "kbId", "chunkIndex", content, "tokenCount", embedding, metadata)
          VALUES (
            ${tenantId}::uuid,
            ${kbId}::uuid,
            ${chunk.chunkIndex},
            ${chunk.content},
            ${chunk.tokenCount},
            NULL,
            ${metadata}::jsonb
          )`;
      }
    }
    return chunks;
  }

  /**
   * How much of the knowledge base is invisible to semantic search.
   *
   * Without this the degradation is undetectable from the outside: the entries
   * exist, the chunks exist, and only the embeddings are missing.
   */
  async embeddingCoverage(
    tenantId: string,
  ): Promise<{ chunks: number; embedded: number; missing: number }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ chunks: bigint; embedded: bigint }>>`
        SELECT count(*) AS chunks, count(embedding) AS embedded
        FROM app.kb_chunks WHERE "tenantId" = ${tenantId}::uuid`;
      const chunks = Number(row?.chunks ?? 0);
      const embedded = Number(row?.embedded ?? 0);
      return { chunks, embedded, missing: chunks - embedded };
    });
  }

  /**
   * Re-embeds every entry whose chunks have no vector, for after an embedding
   * key is finally configured. Without it a knowledge base indexed during an
   * outage stays keyword-only forever — nothing re-runs on its own.
   */
  async reindexMissingEmbeddings(tenantId: string): Promise<{ entries: number; chunks: number }> {
    const stale = await this.uow.withTenant(tenantId, async (tx) => {
      return tx.$queryRaw<Array<{ kbId: string }>>`
        SELECT DISTINCT "kbId" FROM app.kb_chunks
        WHERE "tenantId" = ${tenantId}::uuid AND embedding IS NULL`;
    });
    if (stale.length === 0) return { entries: 0, chunks: 0 };

    let entries = 0;
    let rechunked = 0;
    for (const { kbId } of stale) {
      const entry = await this.get(tenantId, kbId);
      if (!entry) continue;
      // One transaction per entry: a partial re-index is better than losing the
      // whole run to a rate limit halfway through a large knowledge base.
      const chunks = await this.uow.withTenant(tenantId, async (tx) =>
        this.rebuildChunks(tx, tenantId, kbId, entry.content),
      );
      entries += 1;
      rechunked += chunks.length;
    }
    this.logger.log({ tenantId, entries, chunks: rechunked }, 'knowledge base re-indexed');
    return { entries, chunks: rechunked };
  }
}

function vectorToSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
