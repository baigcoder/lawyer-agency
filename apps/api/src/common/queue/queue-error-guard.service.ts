import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUES } from './queue.constants';

/**
 * An EventEmitter 'error' with no listener throws and kills the process —
 * BullMQ queues re-emit connection errors, so without this a Redis outage
 * would crash healthy API pods (NFR-AVAIL-01 demands degradation, not death).
 * With the guard, BullMQ's retry strategy keeps reconnecting in the
 * background; enqueueing calls buffer via the offline queue meanwhile.
 */
@Injectable()
export class QueueErrorGuard implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueErrorGuard.name);

  constructor(
    @InjectQueue(QUEUES.OUTBOX) private readonly outbox: Queue,
    @InjectQueue(QUEUES.DOMAIN_EVENTS) private readonly events: Queue,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notifications: Queue,
  ) {}

  onApplicationBootstrap(): void {
    for (const queue of [this.outbox, this.events, this.notifications]) {
      queue.on('error', (error) => {
        this.logger.error({ queue: queue.name, err: error }, 'queue connection error');
      });
    }
  }
}
