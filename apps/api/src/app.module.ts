import { Module, type NestModule, type MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnv } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { UnitOfWork } from './common/prisma/unit-of-work';
import { HealthModule } from './common/health/health.module';
import { EventsModule } from './common/events/events.module';
import { DOMAIN_EVENT_HANDLERS } from './common/events/domain-event-handler.port';
import { QueueModule } from './common/queue/queue.module';
import { DomainEventsDispatcher } from './common/queue/domain-events-dispatcher.processor';
import { CryptoModule } from './common/crypto/crypto.module';
import { CorrelationMiddleware } from './common/correlation/correlation.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CasesModule } from './modules/cases/cases.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LawyersModule } from './modules/lawyers/lawyers.module';
import { MessagesModule } from './modules/messages/messages.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WhatsappWorkerModule } from './modules/whatsapp/whatsapp-worker.module';
import { WhatsappUpgradeModule } from './modules/whatsapp/whatsapp-upgrade.module';
import { WhatsappUpgradeEventHandler } from './modules/whatsapp/application/whatsapp-upgrade-event.handler';
import { AiModule } from './modules/ai/ai.module';
import { AiEventHandler } from './modules/ai/application/ai-event.handler';
import { RagModule } from './modules/rag/rag.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CaseAutoCreateHandler } from './modules/cases/application/case-auto-create.handler';
import { PaymentsModule, createPaymentFeeHandlers, createPaymentReceiptHandlers } from './modules/payments/payments.module';
import { PaymentFeeMessageHandler } from './modules/payments/application/payment-fee-message.handler';
import { PaymentReceiptHandler } from './modules/payments/application/payment-receipt.handler';
import { NotificationsModule, createNotificationHandlers } from './modules/notifications/notifications.module';
import { NotificationDispatcher } from './modules/notifications/application/notification-dispatcher.service';
import { InboxModule } from './modules/inbox/inbox.module';
import { AnalyticsModule, createAnalyticsHandlers } from './modules/analytics/analytics.module';
import { AnalyticsProjector } from './modules/analytics/application/analytics-projector.service';
import { AuditModule } from './modules/audit/audit.module';
import { FirmProfileModule } from './modules/firm-profile/firm-profile.module';

const isWorker = process.env['API_ROLE'] === 'worker';

@Module({
  imports: [
    // Validated at boot; the process refuses to start on bad config (NFR-SEC-02).
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        // One correlation id per request, shared with CorrelationMiddleware.
        genReqId: (req) => {
          const header = req.headers['x-correlation-id'];
          return typeof header === 'string' ? header : randomUUID();
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            // Clerk proxy headers can contain the same session credential as
            // Authorization; never persist them in structured request logs.
            'req.headers.x-clerk-auth-token',
            'req.headers.x-clerk-auth-signature',
          ],
          remove: true,
        },
        autoLogging: {
          ignore: (req) => (req.url ?? '').startsWith('/health'),
        },
      },
    }),
    PrismaModule,
    EventsModule,
    CryptoModule,
    // Role-aware: consumers exist only on role=worker (D-013). The env value
    // is read raw here (module composition precedes ConfigModule validation);
    // main.ts uses the validated config for the listen branch.
    QueueModule.register(isWorker ? 'worker' : 'api'),
    HealthModule,
    isWorker ? WhatsappWorkerModule.register() : WhatsappModule.register('api'),
    WhatsappUpgradeModule.register(isWorker ? 'worker' : 'api'),
    // Domain modules — Cases is the implemented reference (4b); the rest are
    // boundary-declared shells filled in their own phases.
    CasesModule.register(isWorker ? 'worker' : 'api'),
    AuthModule,
    UsersModule,
    LawyersModule,
    MessagesModule,
    AiModule.register(isWorker ? 'worker' : 'api'),
    RagModule,
    DocumentsModule.register(isWorker ? 'worker' : 'api'),
    AppointmentsModule,
    PaymentsModule.register(isWorker ? 'worker' : 'api'),
    NotificationsModule.register(isWorker ? 'worker' : 'api'),
    InboxModule.register(isWorker ? 'worker' : 'api'),
    AnalyticsModule.register(isWorker ? 'worker' : 'api'),
    AuditModule,
    FirmProfileModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    {
      provide: DOMAIN_EVENT_HANDLERS,
      useFactory: (
        ai: AiEventHandler,
        dispatcher: NotificationDispatcher,
        uow: UnitOfWork,
        projector: AnalyticsProjector,
        whatsappUpgrade: WhatsappUpgradeEventHandler,
        caseAutoCreate: CaseAutoCreateHandler,
        paymentFee?: PaymentFeeMessageHandler,
        paymentReceipt?: PaymentReceiptHandler,
      ) => [
        ai,
        whatsappUpgrade,
        caseAutoCreate,
        ...createNotificationHandlers(dispatcher, uow),
        ...createAnalyticsHandlers(projector),
        ...(paymentFee ? createPaymentFeeHandlers(paymentFee) : []),
        ...(paymentReceipt ? createPaymentReceiptHandlers(paymentReceipt) : []),
      ],
      inject: [
        AiEventHandler,
        NotificationDispatcher,
        UnitOfWork,
        AnalyticsProjector,
        WhatsappUpgradeEventHandler,
        CaseAutoCreateHandler,
        { token: PaymentFeeMessageHandler, optional: true },
        { token: PaymentReceiptHandler, optional: true },
      ],
    },
    // Domain-events consumer needs DOMAIN_EVENT_HANDLERS, which is provided by
    // this module. It must live here rather than in QueueModule so the dependency
    // resolves correctly (D-013).
    ...(isWorker ? [DomainEventsDispatcher] : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
