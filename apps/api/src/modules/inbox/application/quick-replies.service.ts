import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { Prisma } from '../../../generated/prisma/client';
import { QUICK_REPLY_STARTER_PACK } from '../domain/quick-reply-starter-pack';

export interface QuickReplyInput {
  title: string;
  body: string;
  language: 'en' | 'ur';
}

const SELECT = { id: true, title: true, body: true, language: true, updatedAt: true } as const;

@Injectable()
export class QuickRepliesService {
  constructor(private readonly uow: UnitOfWork) {}

  async list(tenantId: string) {
    return this.uow.withTenant(tenantId, (tx) =>
      tx.quickReply.findMany({ select: SELECT, orderBy: [{ language: 'asc' }, { title: 'asc' }] }),
    );
  }

  async create(tenantId: string, input: QuickReplyInput) {
    return this.uow.withTenant(tenantId, (tx) =>
      tx.quickReply.create({ data: { tenantId, ...input }, select: SELECT }).catch(duplicateTitle),
    );
  }

  async update(tenantId: string, id: string, input: QuickReplyInput) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.quickReply.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('quick reply not found');
      return tx.quickReply.update({ where: { id }, data: input, select: SELECT }).catch(duplicateTitle);
    });
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const { count } = await tx.quickReply.deleteMany({ where: { id } });
      return { deleted: count > 0 };
    });
  }

  /** Adds the starter replies the firm doesn't already have; safe to run twice. */
  async addStarterPack(tenantId: string): Promise<{ added: number }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const { count } = await tx.quickReply.createMany({
        data: QUICK_REPLY_STARTER_PACK.map((reply) => ({ tenantId, ...reply })),
        skipDuplicates: true,
      });
      return { added: count };
    });
  }
}

function duplicateTitle(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('A quick reply with this title already exists for this language');
  }
  throw error;
}
