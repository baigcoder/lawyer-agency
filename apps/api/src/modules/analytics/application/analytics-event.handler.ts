import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { AnalyticsProjector } from './analytics-projector.service';

/**
 * Domain-event handler that projects analytics aggregates (Phase 14, D-018).
 * Registered alongside the AI and notification handlers on the shared
 * domain-events dispatcher.
 */
@Injectable()
export class AnalyticsEventHandler implements DomainEventHandler {
  readonly eventType = '__MULTIPLE__';

  constructor(private readonly projector: AnalyticsProjector) {}

  async handle(job: DomainEventJob): Promise<void> {
    void job;
  }
}

export function createAnalyticsHandlers(projector: AnalyticsProjector): DomainEventHandler[] {
  return [
    {
      eventType: DOMAIN_EVENTS.ConversationCreated,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { conversationId: string };
        await projector.recordNewConversation(job.tenantId, payload.conversationId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.AiReplySent,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { conversationId: string };
        await projector.recordAiHandled(job.tenantId, payload.conversationId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.AiIntakeCompleted,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { conversationId: string };
        await projector.recordAiHandled(job.tenantId, payload.conversationId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.ConversationStateChanged,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { conversationId: string; to: string };
        if (payload.to === 'HUMAN_ACTIVE' || payload.to === 'HUMAN_REQUIRED') {
          await projector.recordHumanHandled(job.tenantId, payload.conversationId, job.occurredAt);
        }
      },
    },
    {
      eventType: DOMAIN_EVENTS.StaffMessageSent,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { conversationId: string };
        await projector.recordHumanHandled(job.tenantId, payload.conversationId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.AiEscalationTriggered,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { escalationId: string };
        await projector.recordEscalation(job.tenantId, payload.escalationId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.CaseCreated,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { caseId: string };
        await projector.recordCaseOpened(job.tenantId, payload.caseId, job.occurredAt);
      },
    },
    {
      eventType: DOMAIN_EVENTS.CaseStatusChanged,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { caseId: string; to: string };
        if (payload.to === 'CLOSED') {
          await projector.recordCaseClosed(job.tenantId, payload.caseId, job.occurredAt);
        }
      },
    },
    {
      eventType: DOMAIN_EVENTS.PaymentSucceeded,
      async handle(job: DomainEventJob) {
        const payload = job.payload as { amountCents: number };
        await projector.recordPayment(job.tenantId, payload.amountCents, job.occurredAt);
      },
    },
  ];
}
