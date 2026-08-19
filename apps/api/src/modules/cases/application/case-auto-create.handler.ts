import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { CasesService } from './cases.service';

/**
 * Auto-creates a case when intake completes with a practice area and no case exists (D-112).
 */
@Injectable()
export class CaseAutoCreateHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.AiIntakeCompleted;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly cases: CasesService,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    const { conversationId, practiceArea } = job.payload as {
      conversationId: string;
      practiceArea?: string;
    };
    if (!practiceArea?.trim()) return;

    const ctx = await this.uow.withTenant(job.tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation || conversation.caseId) return null;

      const intake = await tx.intakeSession.findFirst({
        where: { conversationId },
      });
      const fields = intake?.extractedFields;
      const qualified =
        typeof fields === 'object' &&
        fields !== null &&
        !Array.isArray(fields) &&
        (fields as Record<string, unknown>)['qualified'] === true;

      if (!qualified) return null;

      return { clientId: conversation.clientId, practiceArea };
    });

    if (!ctx) return;

    const created = await this.cases.create(job.tenantId, {
      clientId: ctx.clientId,
      matterType: ctx.practiceArea,
      urgency: 'NORMAL',
      summary: null,
      intakeData: {},
    });

    await this.uow.withTenant(job.tenantId, async (tx) => {
      await tx.conversation.update({
        where: { id: conversationId },
        data: { caseId: created.id },
      });
    });
  }
}
