import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { UnitOfWork } from '../../../../common/prisma/unit-of-work';
import type { Env } from '../../../../config/env';
import type { ChannelNotification, NotificationChannel } from '../../application/channels/notification-channel.port';

/**
 * Web Push channel (Phase 12). Sends a push notification to every active
 * subscription for the user. Missing or invalid VAPID keys are logged and
 * treated as a soft failure so the rest of the notification pipeline
 * continues.
 */
@Injectable()
export class WebPushChannel implements NotificationChannel {
  readonly name = 'WEB_PUSH';
  private readonly logger = new Logger(WebPushChannel.name);
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService<Env, true>,
  ) {
    const publicKey = this.config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = this.config.get('VAPID_PRIVATE_KEY', { infer: true });
    const subject = this.config.get('VAPID_SUBJECT', { infer: true });
    this.vapidConfigured = Boolean(publicKey && privateKey && subject);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    }
  }

  async send(notification: ChannelNotification): Promise<{ sent: boolean }> {
    if (!this.vapidConfigured) {
      this.logger.debug('VAPID not configured; skipping web push');
      return { sent: false };
    }

    const subscriptions = await this.uow.withTenant(notification.tenantId, async (tx) => {
      return tx.pushSubscription.findMany({
        where: { userId: notification.userId },
      });
    });

    if (subscriptions.length === 0) return { sent: false };

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url,
      type: notification.type,
    });

    let sentAny = false;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sentAny = true;
        } catch (error) {
          this.logger.warn({ endpoint: sub.endpoint, error }, 'Web push send failed');
          // 410 Gone / 404 Not Found means the subscription is stale.
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await this.uow.withTenant(notification.tenantId, (tx) =>
              tx.pushSubscription.delete({ where: { id: sub.id } }),
            );
          }
        }
      }),
    );

    return { sent: sentAny };
  }
}
