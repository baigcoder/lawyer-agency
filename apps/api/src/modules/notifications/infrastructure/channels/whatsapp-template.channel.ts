import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../../common/prisma/unit-of-work';
import { SendService } from '../../../whatsapp/application/send.service';
import type { ChannelNotification, NotificationChannel } from '../../application/channels/notification-channel.port';

/**
 * WhatsApp template channel (Phase 12). Delivers high-priority alerts via
 * approved Meta templates, which work outside the 24h session window (D-003).
 *
 * v1 uses a single configured template name per tenant; richer per-type
 * template selection can be added later.
 */
@Injectable()
export class WhatsappTemplateChannel implements NotificationChannel {
  readonly name = 'WHATSAPP_TEMPLATE';
  private readonly logger = new Logger(WhatsappTemplateChannel.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly sendService: SendService,
  ) {}

  async send(notification: ChannelNotification): Promise<{ sent: boolean }> {
    const user = await this.uow.withTenant(notification.tenantId, async (tx) => {
      const u = await tx.user.findFirst({
        where: { id: notification.userId },
        include: { lawyer: true },
      });
      return u;
    });

    if (!user?.lawyer?.whatsappNumber) {
      this.logger.debug({ userId: notification.userId }, 'No lawyer WhatsApp number; skipping template');
      return { sent: false };
    }

    // Resolve a conversation for this user so the existing send path can
    // create the outbound message row. We use the user's own phone as the
    // recipient; if no client conversation exists, we cannot send.
    const conversation = await this.uow.withTenant(notification.tenantId, async (tx) => {
      return tx.conversation.findFirst({
        where: { assignedToId: notification.userId },
        orderBy: { updatedAt: 'desc' },
      });
    });

    if (!conversation) {
      this.logger.debug({ userId: notification.userId }, 'No assigned conversation for template routing');
      return { sent: false };
    }

    try {
      await this.sendService.send(notification.tenantId, {
        kind: 'template',
        conversationId: conversation.id,
        toWaPhone: user.lawyer.whatsappNumber,
        senderType: 'SYSTEM',
        templateName: 'alert_staff',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: notification.body }],
          },
        ],
      });
      return { sent: true };
    } catch (error) {
      this.logger.warn({ error, userId: notification.userId }, 'WhatsApp template send failed');
      return { sent: false };
    }
  }
}
