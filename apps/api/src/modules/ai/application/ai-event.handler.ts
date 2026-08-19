import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import type { ProcessInboundMessage } from './ai-orchestrator.service';
import { AiOrchestratorService } from './ai-orchestrator.service';

/**
 * AI domain-event handler: triggers the agent pipeline for every inbound
 * WhatsApp message. Registered in the shared domain-events dispatcher.
 */
@Injectable()
export class AiEventHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.MessageInboundReceived;

  constructor(private readonly orchestrator: AiOrchestratorService) {}

  async handle(job: DomainEventJob): Promise<void> {
    const event = job.payload as ProcessInboundMessage;
    await this.orchestrator.process({ ...event, tenantId: job.tenantId });
  }
}
