import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';
import type { Env } from '../../config/env';
import { OutboxDispatcher } from './outbox-dispatcher.processor';
import { OutboxScheduler } from './outbox-scheduler.service';
import { QueueErrorGuard } from './queue-error-guard.service';
import { QUEUES } from './queue.constants';

/**
 * Role-aware wiring (D-013): BOTH roles get producer access (the API
 * enqueues too), but consumers — the outbox dispatcher and its scheduler —
 * are only instantiated on the worker role.
 */
@Global()
@Module({})
export class QueueModule {
  static register(role: 'api' | 'worker' | 'voice'): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => {
            const connection: RedisOptions = {
              url: config.get('REDIS_URL', { infer: true }),
              // BullMQ worker connections require this
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            };
            return { connection };
          },
        }),
        BullModule.registerQueue(
          { name: QUEUES.OUTBOX },
          { name: QUEUES.DOMAIN_EVENTS },
          { name: QUEUES.WHATSAPP_INBOUND },
          { name: QUEUES.WHATSAPP_STATUS },
          { name: QUEUES.WHATSAPP_MEDIA },
          { name: QUEUES.WHATSAPP_PILOT },
          { name: QUEUES.VOICE_CALLS },
          { name: QUEUES.NOTIFICATIONS },
        ),
      ],
      providers:
        role === 'worker'
          ? [QueueErrorGuard, OutboxDispatcher, OutboxScheduler]
          : [QueueErrorGuard],
      exports: [BullModule],
    };
  }
}
