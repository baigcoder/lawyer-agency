import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { UnitOfWork } from '../prisma/unit-of-work';
import { QUEUES } from './queue.constants';

interface OutboxRow {
  id: string;
  tenantId: string;
  type: string;
  payload: unknown;
  occurredAt: Date;
}

/**
 * Outbox dispatcher (ADR-003/D-014): claims unpublished events in batches
 * (FOR UPDATE SKIP LOCKED — multiple worker replicas won't double-claim),
 * enqueues each onto the domain-events queue with jobId = event id (so a
 * dispatcher crash mid-batch can never duplicate an enqueue), then marks
 * them published. Consumers downstream stay idempotent regardless (D-015).
 */
@Processor(QUEUES.OUTBOX, { concurrency: 1 })
export class OutboxDispatcher extends WorkerHost {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly uow: UnitOfWork,
    @InjectQueue(QUEUES.DOMAIN_EVENTS) private readonly eventsQueue: Queue,
  ) {
    super();
  }

  async process(): Promise<{ dispatched: number }> {
    const batch = await this.uow.withPlatform((tx) =>
      tx.$queryRaw<OutboxRow[]>`
        SELECT id, "tenantId", type, payload, "occurredAt"
        FROM platform.outbox_events
        WHERE "publishedAt" IS NULL
        ORDER BY "occurredAt"
        LIMIT 100
        FOR UPDATE SKIP LOCKED`,
    );

    for (const event of batch) {
      await this.eventsQueue.add(event.type, { tenantId: event.tenantId, type: event.type, payload: event.payload, occurredAt: event.occurredAt }, {
        jobId: event.id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        // failures stay in the queue as the DLQ signal (Phase 9/16 alerting)
        removeOnFail: false,
      });
      await this.uow.withPlatform((tx) =>
        tx.$executeRaw`UPDATE platform.outbox_events SET "publishedAt" = now() WHERE id = ${event.id}::uuid`,
      );
    }

    if (batch.length > 0) {
      this.logger.log({ dispatched: batch.length }, 'outbox batch dispatched');
    }
    return { dispatched: batch.length };
  }
}
