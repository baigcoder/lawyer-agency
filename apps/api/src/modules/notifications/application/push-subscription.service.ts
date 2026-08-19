import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Stores and removes browser push subscriptions per user (Phase 12).
 */
@Injectable()
export class PushSubscriptionService {
  constructor(private readonly uow: UnitOfWork) {}

  async save(
    tenantId: string,
    userId: string,
    input: PushSubscriptionInput,
  ): Promise<void> {
    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.pushSubscription.upsert({
        where: { userId_endpoint: { userId, endpoint: input.endpoint } },
        create: {
          tenantId,
          userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        update: {
          p256dh: input.p256dh,
          auth: input.auth,
        },
      });
    });
  }

  async remove(tenantId: string, userId: string, endpoint: string): Promise<void> {
    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.pushSubscription.deleteMany({
        where: { tenantId, userId, endpoint },
      });
    });
  }
}
