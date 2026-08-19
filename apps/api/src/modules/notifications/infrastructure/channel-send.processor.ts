import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { QUEUES } from '../../../common/queue/queue.constants';
import type { ChannelNotification, NotificationChannel } from '../application/channels/notification-channel.port';
import { NOTIFICATION_CHANNELS } from '../application/channels/notification-channel.port';

interface ChannelSendJob {
  tenantId: string;
  channel: string;
  notification: ChannelNotification;
}

/**
 * Worker processor for async notification channels (web push, WhatsApp
 * template, email digest). Each job names a channel; the processor looks up
 * the matching adapter and sends.
 */
@Injectable()
@Processor(QUEUES.NOTIFICATIONS, { concurrency: 5 })
export class ChannelSendProcessor extends WorkerHost {
  private readonly channelMap: Map<string, NotificationChannel>;

  constructor(@Inject(NOTIFICATION_CHANNELS) channels: NotificationChannel[]) {
    super();
    this.channelMap = new Map(channels.map((c) => [c.name, c]));
  }

  async process(job: { data: ChannelSendJob }): Promise<{ sent: boolean }> {
    const { channel, notification } = job.data;
    const adapter = this.channelMap.get(channel);
    if (!adapter) return { sent: false };
    return adapter.send(notification);
  }
}
