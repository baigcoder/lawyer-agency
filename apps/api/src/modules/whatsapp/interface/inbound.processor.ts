import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MessagesService } from '../../messages/application/messages.service';
import type { NormalizedInboundMessage } from '../../../common/messaging/inbound-message';

interface InboundJob {
  tenantId: string;
  message: NormalizedInboundMessage;
}

/**
 * Worker-side consumer for inbound messages.
 * Registered manually by WhatsappWorkerBootstrap when role=worker (D-013).
 * Boundary rule respected: depends on MessagesService, the exported
 * application port of the Messages module — never its internals.
 */
@Injectable()
export class InboundMessageProcessor {
  private readonly logger = new Logger(InboundMessageProcessor.name);

  constructor(private readonly messages: MessagesService) {}

  async process(job: Job<InboundJob>): Promise<void> {
    const { tenantId, message } = job.data;
    // BullMQ serializes Dates to ISO strings in job payloads — restore.
    const normalized: NormalizedInboundMessage = {
      ...message,
      sentAt: new Date(message.sentAt),
    };
    const result = await this.messages.recordInbound(tenantId, normalized);
    if (!result.duplicate) {
      this.logger.log({ wamid: message.wamid, tenantId }, 'inbound message recorded');
    }
  }
}
