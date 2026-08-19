import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

/**
 * Event projector for analytics daily aggregates (Phase 14, D-018).
 * Each handler is idempotent: it upserts the date bucket and increments the
 * relevant counter. Projections live in the platform schema because they are
 * cross-tenant aggregates (tenantId is still the partition key).
 */
@Injectable()
export class AnalyticsProjector {
  private readonly logger = new Logger(AnalyticsProjector.name);

  constructor(private readonly uow: UnitOfWork) {}

  async recordNewConversation(tenantId: string, _conversationId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { newConversations: 1 });
  }

  async recordAiHandled(tenantId: string, _conversationId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { aiHandled: 1 });
  }

  async recordHumanHandled(tenantId: string, _conversationId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { humanHandled: 1 });
  }

  async recordEscalation(tenantId: string, _escalationId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { escalations: 1 });
  }

  async recordCaseOpened(tenantId: string, _caseId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { casesOpened: 1 });
  }

  async recordCaseClosed(tenantId: string, _caseId: string, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { casesClosed: 1 });
  }

  async recordPayment(tenantId: string, amountCents: number, occurredAt: Date): Promise<void> {
    await this.increment(tenantId, occurredAt, { paymentsCents: amountCents });
  }

  private async increment(
    tenantId: string,
    occurredAt: Date,
    deltas: Record<string, number>,
  ): Promise<void> {
    const date = this.toDate(occurredAt);
    const columns = Object.keys(deltas);
    if (columns.length === 0) return;

    const valuePlaceholders = columns.map((_, i) => `$${i + 3}::int`).join(', ');
    const updateClauses = columns.map((c) => `"${c}" = "analytics_daily"."${c}" + EXCLUDED."${c}"`).join(', ');

    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.$executeRawUnsafe(
        `
        INSERT INTO "platform"."analytics_daily" ("tenantId", "date", ${columns.map((c) => `"${c}"`).join(', ')})
        VALUES ($1, $2, ${valuePlaceholders})
        ON CONFLICT ("tenantId", "date") DO UPDATE SET ${updateClauses}, "updatedAt" = now()
        `,
        tenantId,
        date,
        ...columns.map((c) => deltas[c]),
      );
    });
  }

  private toDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
