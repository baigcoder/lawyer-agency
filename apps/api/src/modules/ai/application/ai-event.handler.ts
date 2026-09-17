import { Injectable, Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import {
  conversationLockKey,
  ResourceLockService,
} from '../../../common/locks/resource-lock.service';
import { RetryLaterError } from '../../../common/errors/retry-later.error';
import type { ProcessInboundMessage } from './ai-orchestrator.service';
import { AiOrchestratorService } from './ai-orchestrator.service';

/**
 * One AI turn per conversation at a time.
 *
 * A full turn is retrieval + router + agent + a WhatsApp send, which is
 * comfortably several seconds. The lease covers that with headroom; if a
 * worker dies mid-turn the lease expires rather than wedging the thread.
 */
const TURN_LEASE_MS = 90_000;

/**
 * AI domain-event handler: triggers the agent pipeline for every inbound
 * WhatsApp message. Registered in the shared domain-events dispatcher.
 */
@Injectable()
export class AiEventHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.MessageInboundReceived;
  private readonly logger = new Logger(AiEventHandler.name);

  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly locks: ResourceLockService,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    const event = job.payload as ProcessInboundMessage;
    const params = { ...event, tenantId: job.tenantId };

    const outcome = await this.locks.withLock(
      conversationLockKey(params.tenantId, params.conversationId),
      TURN_LEASE_MS,
      () => this.orchestrator.process(params),
    );

    if (outcome.acquired) return;

    // Someone is already answering this conversation. Hand the job back to the
    // queue instead of waiting: holding a worker slot for the length of
    // another turn is how a burst of messages stalls every tenant. By the time
    // this runs again the in-flight turn will have written its reply, so the
    // rerun sees the full thread — and its own idempotency marker if the two
    // events were duplicates of one message.
    this.logger.log(
      { conversationId: params.conversationId, messageId: params.messageId },
      'conversation busy — deferring AI turn',
    );
    throw new RetryLaterError('another AI turn is in flight for this conversation');
  }
}
