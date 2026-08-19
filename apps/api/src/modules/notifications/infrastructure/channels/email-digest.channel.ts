import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnitOfWork } from '../../../../common/prisma/unit-of-work';
import type { Env } from '../../../../config/env';
import type { ChannelNotification, NotificationChannel } from '../../application/channels/notification-channel.port';

export interface EmailClient {
  sendMail(to: string, subject: string, text: string): Promise<void>;
}

export const EMAIL_CLIENT = Symbol('EMAIL_CLIENT');

/**
 * Email digest channel (Phase 12). In production this is wired to an SMTP
 * provider; in development it logs the message so the channel can be exercised
 * without credentials.
 */
@Injectable()
export class EmailDigestChannel implements NotificationChannel {
  readonly name = 'EMAIL_DIGEST';
  private readonly logger = new Logger(EmailDigestChannel.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_CLIENT) private readonly client: EmailClient,
  ) {}

  async send(notification: ChannelNotification): Promise<{ sent: boolean }> {
    const from = this.config.get('EMAIL_FROM', { infer: true });
    if (!from) {
      this.logger.debug('EMAIL_FROM not configured; logging digest only');
    }

    const user = await this.uow.withTenant(notification.tenantId, async (tx) => {
      return tx.user.findFirst({ where: { id: notification.userId } });
    });
    if (!user?.email) return { sent: false };

    const subject = `[Wakeel] ${notification.title}`;
    const text = `${notification.body}\n\nOpen: ${notification.url ?? '/dashboard/inbox'}`;

    try {
      await this.client.sendMail(user.email, subject, text);
      this.logger.debug({ userId: user.id }, 'Email digest queued/sent');
      return { sent: true };
    } catch (error) {
      this.logger.warn({ error, userId: user.id }, 'Email digest send failed');
      return { sent: false };
    }
  }
}
