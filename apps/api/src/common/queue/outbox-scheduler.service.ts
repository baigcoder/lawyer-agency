import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OUTBOX_DISPATCH_JOB, QUEUES } from './queue.constants';

/**
 * Keeps a repeating dispatch tick registered (worker role only — the
 * processor does nothing without jobs, and nothing enqueues them except
 * this scheduler). 2s cadence: outbox lag stays well inside the
 * notification latency budget (ADR-003 accepted ~1s poll + jitter).
 */
@Injectable()
export class OutboxScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.OUTBOX) private readonly outbox: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.outbox.upsertJobScheduler(
      OUTBOX_DISPATCH_JOB,
      { every: 2000 },
      { name: OUTBOX_DISPATCH_JOB },
    );
  }
}
