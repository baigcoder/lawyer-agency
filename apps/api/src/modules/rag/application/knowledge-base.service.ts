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

    let embeddings: Array<{ vector: number[]; tokensUsed: number }>;
    try {
      embeddings = await this.embeddings.embedBatch(chunks.map((c) => c.content));
    } catch (error) {
      if (!(error instanceof EmbeddingProviderError)) throw error;
      this.logger.warn(
        { tenantId, kbId, reason: error.message.slice(0, 200) },
        'embedding unavailable — indexing knowledge base for keyword retrieval',
      );
      embeddings = chunks.map(() => ({ vector: Array<number>(1536).fill(0), tokensUsed: 0 }));
    }

    // Delete old chunks and insert new ones via raw SQL because Prisma does
    // not support the Unsupported("vector(1536)") column.
    await tx.$executeRaw`
      DELETE FROM app.kb_chunks WHERE "kbId" = ${kbId}::uuid`;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const vector = embeddings[i]?.vector ?? [];
      await tx.$executeRaw`
        INSERT INTO app.kb_chunks ("tenantId", "kbId", "chunkIndex", content, "tokenCount", embedding, metadata)
        VALUES (
          ${tenantId}::uuid,
          ${kbId}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${chunk.tokenCount},
          ${vectorToSql(vector)}::vector,
          ${JSON.stringify({ source: 'manual' })}::jsonb
        )`;
    }
    return chunks;
  }
}

function vectorToSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
