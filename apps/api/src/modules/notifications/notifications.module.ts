import { Module, type DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsService } from './application/notifications.service';
import { createNotificationHandlers, NotificationEventHandler } from './application/notification-event.handler';
import { NotificationDispatcher } from './application/notification-dispatcher.service';
import { UserPreferencesService } from './application/user-preferences.service';
import { PushSubscriptionService } from './application/push-subscription.service';
import { EscalationSlaMonitor } from './infrastructure/escalation-sla-monitor.service';
import { ChannelSendProcessor } from './infrastructure/channel-send.processor';
import { DashboardChannel } from './application/channels/dashboard.channel';
import { WebPushChannel } from './infrastructure/channels/web-push.channel';
import { WhatsappTemplateChannel } from './infrastructure/channels/whatsapp-template.channel';
import { EmailDigestChannel, EMAIL_CLIENT } from './infrastructure/channels/email-digest.channel';
import { LogEmailClient } from './infrastructure/channels/log-email.client';
import { SmtpEmailClient } from './infrastructure/channels/smtp-email.client';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { NotificationsController } from './interface/notifications.controller';
import { NOTIFICATION_CHANNELS } from './application/channels/notification-channel.port';
import { QUEUES } from '../../common/queue/queue.constants';

/**
 * Notifications — lawyer alerts (dashboard/web push/WhatsApp template/email),
 * escalation SLA timer with auto-escalation (FR-NTF-02), client nudges,
 * daily digests. Leaf consumer of domain events.
 *
 * Phase 9: in-app dashboard notifications for domain events + escalation SLA monitor.
 * Phase 12: web push, WhatsApp template, email digest channels + preferences + push subscriptions.
 */
@Module({})
export class NotificationsModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: NotificationsModule,
      imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS }), WhatsappModule.register(role)],
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        NotificationEventHandler,
        NotificationDispatcher,
        UserPreferencesService,
        PushSubscriptionService,
        DashboardChannel,
        WebPushChannel,
        WhatsappTemplateChannel,
        EmailDigestChannel,
        SmtpEmailClient,
        LogEmailClient,
        {
          provide: EMAIL_CLIENT,
          useFactory: (config: ConfigService<Env, true>, smtp: SmtpEmailClient, log: LogEmailClient) => {
            const host = config.get('SMTP_HOST', { infer: true });
            const from = config.get('EMAIL_FROM', { infer: true });
            return host && from ? smtp : log;
          },
          inject: [ConfigService, SmtpEmailClient, LogEmailClient],
        },
        {
          provide: NOTIFICATION_CHANNELS,
          useFactory: (
            dashboard: DashboardChannel,
            webPush: WebPushChannel,
            whatsapp: WhatsappTemplateChannel,
            email: EmailDigestChannel,
          ) => [dashboard, webPush, whatsapp, email],
          inject: [DashboardChannel, WebPushChannel, WhatsappTemplateChannel, EmailDigestChannel],
        },
        ...(role === 'worker' ? [EscalationSlaMonitor, ChannelSendProcessor] : []),
      ],
      exports: [NotificationsService, NotificationDispatcher],
    };
  }
}

export { createNotificationHandlers };
