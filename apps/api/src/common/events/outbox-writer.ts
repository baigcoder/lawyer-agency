import { Injectable } from '@nestjs/common';
import type { DbTx } from '../persistence/db-tx';
import { domainEventPayloads, type DomainEventType } from './domain-events';

/**
 * Transactional outbox (ADR-003 / D-014): callers append the event inside
 * the SAME transaction as the state change, so a committed case can never
 * lose its `case.created` event and vice versa. The dispatcher
 * (common/queue) publishes to BullMQ after commit.
 */
@Injectable()
export class OutboxWriter {
  async append(
    tx: DbTx,
    tenantId: string,
    type: DomainEventType,
    payload: unknown,
  ): Promise<void> {
    // A payload that fails its schema is a programmer error, not a runtime
    // condition — throw and roll back the enclosing transaction.
    const validated = domainEventPayloads[type].parse(payload);
    await tx.outboxEvent.create({
      data: { tenantId, type, payload: validated },
    });
  }
}
