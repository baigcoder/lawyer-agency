import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MessagesService } from '../../messages/application/messages.service';
import type { WaStatus } from '../application/dto';

interface StatusJob {
  tenantId: string;
  status: WaStatus;
}

/**
 * Worker-side consumer for Meta delivery receipts (sent/delivered/read/failed).
 * Registered manually by WhatsappWorkerBootstrap when role=worker (D-013).
 * Depends on MessagesService — the exported application port of the Messages
 * module — never its internals.
 */
@Injectable()
export class StatusUpdateProcessor {
  private readonly logger = new Logger(StatusUpdateProcessor.name);

  constructor(private readonly messages: MessagesService) {}

  async process(job: Job<StatusJob>): Promise<void> {
    const { tenantId, status } = job.data;
    const result = await this.messages.applyStatusUpdate(tenantId, status);
    if (result.updated) {
      this.logger.log({ wamid: status.id, status: status.status, tenantId }, 'delivery status applied');
    }
  }
}
