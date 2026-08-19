import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  channel?: 'DASHBOARD' | 'WEB_PUSH' | 'WHATSAPP_TEMPLATE';
}

export interface NotificationFilters {
  userId: string;
  unreadOnly?: boolean | undefined;
  limit?: number | undefined;
}

/**
 * In-app notification store (Phase 9). Creates dashboard rows for domain
 * events and escalation SLA breaches. Real-time push (WebSocket/web-push)
 * and WhatsApp-template channels land in later phases.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly uow: UnitOfWork) {}

  async create(input: CreateNotificationInput): Promise<void> {
    await this.uow.withTenant(input.tenantId, async (tx) => {
      await tx.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          payload: toInputJson(input.payload),
          channel: input.channel ?? 'DASHBOARD',
        },
      });
    });
  }

  async createForUsers(
    tenantId: string,
    userIds: string[],
    type: string,
    payload: Record<string, unknown>,
    channel: CreateNotificationInput['channel'] = 'DASHBOARD',
  ): Promise<void> {
    await this.uow.withTenant(tenantId, async (tx) => {
      for (const userId of userIds) {
        await tx.notification.create({
          data: {
            tenantId,
            userId,
            type,
            payload: toInputJson(payload),
            channel: channel ?? 'DASHBOARD',
          },
        });
      }
    });
  }

  async list(tenantId: string, filters: NotificationFilters) {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.notification.findMany({
        where: {
          tenantId,
          userId: filters.userId,
          ...(filters.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
      });
    });
  }

  async markRead(tenantId: string, userId: string, notificationId: string): Promise<boolean> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.notification.findFirst({
        where: { id: notificationId, tenantId, userId },
      });
      if (!existing) return false;
      await tx.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
      return true;
    });
  }

  async unreadCount(tenantId: string, userId: string): Promise<number> {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.notification.count({ where: { tenantId, userId, readAt: null } });
    });
  }
}
