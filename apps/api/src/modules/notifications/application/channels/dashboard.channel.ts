import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../../common/persistence/json';
import type { ChannelNotification, NotificationChannel } from './notification-channel.port';

/**
 * In-app dashboard channel. Persists a notification row so the dashboard
 * badge/list picks it up.
 */
@Injectable()
export class DashboardChannel implements NotificationChannel {
  readonly name = 'DASHBOARD';

  constructor(private readonly uow: UnitOfWork) {}

  async send(notification: ChannelNotification): Promise<{ sent: boolean }> {
    await this.uow.withTenant(notification.tenantId, async (tx) => {
      await tx.notification.create({
        data: {
          tenantId: notification.tenantId,
          userId: notification.userId,
          type: notification.type,
          // The bell renders title/body and links to url; payload alone is only ids.
          payload: toInputJson({
            ...notification.payload,
            title: notification.title,
            body: notification.body,
            url: notification.url,
          }),
          channel: 'DASHBOARD',
        },
      });
    });
    return { sent: true };
  }
}
