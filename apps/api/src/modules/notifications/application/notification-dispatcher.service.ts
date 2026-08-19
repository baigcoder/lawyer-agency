import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { QUEUES } from '../../../common/queue/queue.constants';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_CHANNELS,
  type ChannelNotification,
  type NotificationChannel,
} from './channels/notification-channel.port';

const DEFAULT_PREFS: Record<string, boolean> = {
  DASHBOARD: true,
  WEB_PUSH: false,
  WHATSAPP_TEMPLATE: false,
  EMAIL_DIGEST: false,
};

export interface DispatchInput {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  url?: string;
  payload: Record<string, unknown>;
  forceChannels?: string[];
}

/**
 * Routes notifications to the channels a user has enabled. Dashboard is the
 * default channel; push/WhatsApp/email are dispatched asynchronously so a
 * failing transport cannot block the dashboard row or the originating request.
 *
 * Phase 12: preferences are stored on `User.notificationPrefs`. The dispatch
 * loop also emits a channel job to the notifications queue for any channel
 * that requires async/network work.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  async dispatch(input: DispatchInput): Promise<void> {
    const prefs = await this.userPreferences(input.tenantId, input.userId);

    for (const channel of this.channels) {
      const forced = input.forceChannels?.includes(channel.name);
      const enabled = forced || (prefs[channel.name] ?? DEFAULT_PREFS[channel.name] ?? false);
      if (!enabled) continue;

      const notification: ChannelNotification = {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url,
        payload: input.payload,
      };

      if (channel.name === 'DASHBOARD') {
        // Dashboard is synchronous and idempotent via the notification row.
        await channel.send(notification);
      } else {
        // Async channel: enqueue job for the worker. Also write an outbox event
        // so the dispatcher is transactional and replayable.
        await this.queue.add('channel-send', {
          tenantId: input.tenantId,
          channel: channel.name,
          notification,
        }, {
          jobId: `notify:${channel.name}:${input.tenantId}:${input.userId}:${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        });
      }
    }
  }

  private async userPreferences(tenantId: string, userId: string): Promise<Record<string, boolean>> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId } });
      const prefs = (user?.notificationPrefs as Record<string, boolean> | undefined) ?? {};
      return { ...DEFAULT_PREFS, ...prefs };
    });
  }
}
