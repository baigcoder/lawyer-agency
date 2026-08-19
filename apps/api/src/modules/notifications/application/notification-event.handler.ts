import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { NotificationDispatcher } from './notification-dispatcher.service';

/**
 * Domain-event handler for notifications (Phase 9 + 12). Dispatches through
 * user-configured channels for case lifecycle events and AI escalations.
 *
 * Recipient strategy: notify all active users of the tenant. Per-user
 * preferences control which channels fire (dashboard is the default).
 */
@Injectable()
export class NotificationEventHandler implements DomainEventHandler {
  readonly eventType = '__MULTIPLE__';
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly uow: UnitOfWork,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    // The dispatcher routes by eventType; this class is a factory for typed
    // handlers below. It is never registered directly.
    void job;
  }
}

export function createNotificationHandlers(
  dispatcher: NotificationDispatcher,
  uow: UnitOfWork,
): DomainEventHandler[] {
  async function activeUserIds(tenantId: string): Promise<string[]> {
    return uow.withTenant(tenantId, async (tx) => {
      const users = await tx.user.findMany({
        where: { tenantId, status: { not: 'INVITED' } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    });
  }

  return [
    {
      eventType: DOMAIN_EVENTS.CaseCreated,
      async handle(job: DomainEventJob) {
        const { caseId, clientId, reference, matterType } = job.payload as {
          caseId: string;
          clientId: string;
          reference: string;
          matterType: string;
        };
        const userIds = await activeUserIds(job.tenantId);
        await Promise.all(
          userIds.map((userId) =>
            dispatcher.dispatch({
              tenantId: job.tenantId,
              userId,
              type: 'case.created',
              title: 'New case opened',
              body: `Case ${reference} (${matterType}) was opened.`,
              url: `/dashboard/cases/${caseId}`,
              payload: { caseId, clientId, reference, matterType },
            }),
          ),
        );
      },
    },
    {
      eventType: DOMAIN_EVENTS.AiEscalationTriggered,
      async handle(job: DomainEventJob) {
        const { conversationId, escalationId, triggerType } = job.payload as {
          conversationId: string;
          escalationId: string;
          triggerType: string;
        };
        const userIds = await activeUserIds(job.tenantId);
        await Promise.all(
          userIds.map((userId) =>
            dispatcher.dispatch({
              tenantId: job.tenantId,
              userId,
              type: 'escalation.opened',
              title: 'Escalation: human required',
              body: `A conversation was escalated: ${triggerType}.`,
              url: `/dashboard/inbox/${conversationId}`,
              payload: { conversationId, escalationId, triggerType },
            }),
          ),
        );
      },
    },
    {
      eventType: DOMAIN_EVENTS.AiIntakeCompleted,
      async handle(job: DomainEventJob) {
        const { conversationId, intakeSessionId, practiceArea } = job.payload as {
          conversationId: string;
          intakeSessionId: string;
          practiceArea?: string;
        };
        const userIds = await activeUserIds(job.tenantId);
        await Promise.all(
          userIds.map((userId) =>
            dispatcher.dispatch({
              tenantId: job.tenantId,
              userId,
              type: 'intake.completed',
              title: 'Intake completed',
              body: practiceArea
                ? `A client completed intake for ${practiceArea}.`
                : 'A client completed intake.',
              url: `/dashboard/inbox/${conversationId}`,
              payload: { conversationId, intakeSessionId, practiceArea },
            }),
          ),
        );
      },
    },
    {
      eventType: DOMAIN_EVENTS.PaymentProofReceived,
      async handle(job: DomainEventJob) {
        const { paymentId, clientId, conversationId } = job.payload as {
          paymentId: string;
          clientId: string;
          conversationId?: string;
        };
        const details = await uow.withTenant(job.tenantId, async (tx) => {
          const payment = await tx.payment.findFirst({
            where: { id: paymentId },
            include: { client: { select: { name: true, waPhone: true } } },
          });
          return payment;
        });
        const clientLabel =
          details?.client?.name?.trim() || details?.client?.waPhone || clientId || 'a client';
        const amount = `PKR ${Math.round((details?.amountCents ?? 0) / 100).toLocaleString('en-PK')}`;
        const userIds = await activeUserIds(job.tenantId);
        await Promise.all(
          userIds.map((userId) =>
            dispatcher.dispatch({
              tenantId: job.tenantId,
              userId,
              type: 'payment.proof_received',
              title: `Payment screenshot: ${amount}`,
              body: `${clientLabel} sent a payment screenshot. Verify it in Inbox.`,
              url: conversationId ? `/dashboard/inbox?conversation=${conversationId}` : '/dashboard/inbox',
              payload: { paymentId, clientId, conversationId },
              forceChannels: ['DASHBOARD'],
            }),
          ),
        );
      },
    },
    {
      eventType: DOMAIN_EVENTS.PaymentSucceeded,
      async handle(job: DomainEventJob) {
        const { paymentId, amountCents, clientId, caseId } = job.payload as {
          paymentId: string;
          amountCents: number;
          clientId?: string;
          caseId?: string;
        };
        const details = await uow.withTenant(job.tenantId, async (tx) => {
          const payment = await tx.payment.findFirst({
            where: { id: paymentId },
            include: {
              client: { select: { name: true, waPhone: true } },
              case: { select: { reference: true, matterType: true } },
            },
          });
          return payment;
        });
        const clientLabel =
          details?.client?.name?.trim() ||
          details?.client?.waPhone ||
          clientId ||
          'a client';
        const workLabel =
          details?.description?.trim() ||
          (details?.case
            ? `Case ${details.case.reference}${details.case.matterType ? ` (${details.case.matterType})` : ''}`
            : 'unspecified work');
        const amount = `PKR ${Math.round((amountCents ?? details?.amountCents ?? 0) / 100).toLocaleString('en-PK')}`;
        const userIds = await activeUserIds(job.tenantId);
        await Promise.all(
          userIds.map((userId) =>
            dispatcher.dispatch({
              tenantId: job.tenantId,
              userId,
              type: 'payment.succeeded',
              title: `Payment received: ${amount}`,
              body: `${clientLabel} paid ${amount} for ${workLabel}.`,
              url: '/dashboard/payments',
              payload: { paymentId, clientId, caseId },
              forceChannels: ['DASHBOARD', 'EMAIL_DIGEST'],
            }),
          ),
        );
      },
    },
  ];
}
