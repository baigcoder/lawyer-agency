import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from './queue.constants';
import {
  DOMAIN_EVENT_HANDLERS,
  type DomainEventHandler,
  type DomainEventJob,
} from '../events/domain-event-handler.port';

/**
 * Single consumer for the `domain-events` queue (D-014/D-015). Routes each
 * event by its BullMQ job name to the registered handler(s). Keeps the queue
 * topology simple: one queue, many handlers, no duplicate processors.
 */
@Processor(QUEUES.DOMAIN_EVENTS, { concurrency: 10 })
export class DomainEventsDispatcher extends WorkerHost {
  private readonly logger = new Logger(DomainEventsDispatcher.name);

  constructor(@Inject(DOMAIN_EVENT_HANDLERS) private readonly handlers: DomainEventHandler[]) {
    super();
  }

  async process(job: Job<DomainEventJob>): Promise<void> {
    const matches = this.handlers.filter((h) => h.eventType === job.name);
    if (matches.length === 0) {
      this.logger.debug({ eventType: job.name }, 'no handler registered for domain event');
      return;
    }

    // BullMQ serializes Dates in job payloads to ISO strings. Handlers expect
    // a Date object for occurredAt, so restore it before dispatching.
    const event: DomainEventJob = { ...job.data };
    if (typeof event.occurredAt === 'string') {
      event.occurredAt = new Date(event.occurredAt);
    }

    try {
      await Promise.all(matches.map((h) => h.handle(event)));
    } catch (error) {
      // Permanent failures (invalid recipient, unknown instance, …) can never
      // succeed on retry, and each retry re-runs the AI pipeline. Discard the
      // job so it fails once with the real reason instead of burning the
      // retry budget (D-015).
      if (isNonRetryable(error)) {
        this.logger.warn(
          { eventType: job.name, error: error instanceof Error ? error.message : String(error) },
          'discarding non-retryable domain event',
        );
        // BullMQ <6.1 has no job.discard(); bumping attemptsMade to the
        // configured max makes the final failure terminal with the real
        // reason in the failed set.
        job.attemptsMade = job.opts.attempts ?? 1;
        throw error;
      }
      throw error;
    }
  }
}

function isNonRetryable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'nonRetryable' in error &&
    (error as { nonRetryable?: unknown }).nonRetryable === true
  );
}
