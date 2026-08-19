import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from 'nestjs-pino';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { QUEUES } from '../../common/queue/queue.constants';
import { InboundMessageProcessor } from './interface/inbound.processor';

/**
 * Explicit BullMQ worker bootstrap for the WhatsApp inbound queue.
 *
 * Evolution handles media delivery inline and status receipts are deferred,
 * so only the inbound processor remains active in Phase 1.
 */
@Injectable()
export class WhatsappWorkerBootstrap implements OnModuleInit, OnApplicationShutdown {
  private workers: Worker[] = [];

  constructor(
    @InjectQueue(QUEUES.WHATSAPP_INBOUND) private readonly inboundQueue: Queue,
    private readonly inboundProcessor: InboundMessageProcessor,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = (this.inboundQueue.opts as { connection?: ConnectionOptions }).connection;
    if (!connection) {
      throw new Error('WhatsApp worker could not resolve Redis connection from queue options');
    }

    const inboundWorker = new Worker(
      QUEUES.WHATSAPP_INBOUND,
      (job: Job) => this.inboundProcessor.process(job),
      { connection, concurrency: 10 },
    );
    this.attachWorkerLogging(inboundWorker, 'inbound');
    this.workers.push(inboundWorker);

    this.logger.log('WhatsApp inbound worker started');
  }

  private attachWorkerLogging(worker: Worker, queueLabel: string): void {
    worker.on('error', (error: Error) => {
      this.logger.error({ queue: queueLabel, error: error.message }, 'worker error');
    });
    worker.on('failed', (job, error) => {
      const err = error as Error;
      this.logger.error(
        { queue: queueLabel, jobId: job?.id, error: err.message },
        'job failed',
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}
