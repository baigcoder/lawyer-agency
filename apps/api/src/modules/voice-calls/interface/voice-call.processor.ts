import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../../../common/queue/queue.constants';
import { VoiceSessionRunner, type VoiceCallJob } from '../application/voice-session.runner';

@Processor(QUEUES.VOICE_CALLS, { concurrency: 4 })
export class VoiceCallProcessor extends WorkerHost {
  private readonly logger = new Logger(VoiceCallProcessor.name);

  constructor(private readonly runner: VoiceSessionRunner) {
    super();
  }

  async process(job: Job<VoiceCallJob>): Promise<void> {
    this.logger.log({ jobId: job.id, kind: job.data.kind, tenantId: job.data.tenantId }, 'voice call job');
    await this.runner.handle(job.data);
  }
}
