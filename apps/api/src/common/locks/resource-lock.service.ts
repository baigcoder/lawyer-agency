import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env';

/**
 * Short-lived distributed mutex over Redis.
 *
 * The `domain-events` queue runs at concurrency 10 across every worker
 * replica, and nothing tied a job to the conversation it was about. Two
 * messages from the same client arriving a second apart were therefore
 * answered by two concurrent AI turns: both read the same history, both
 * replied, and both raced to create the same escalation.
 *
 * Correctness notes:
 *  - The value is a random token, and release is a compare-and-delete in Lua,
 *    so a slow holder whose lease already expired can never delete the lock a
 *    later holder now owns.
 *  - Leases expire on their own, so a crashed worker cannot wedge a
 *    conversation permanently.
 */
@Injectable()
export class ResourceLockService implements OnModuleDestroy {
  private readonly logger = new Logger(ResourceLockService.name);
  private readonly redis: Redis;

  /** Delete the key only if this caller still owns it. */
  private static readonly RELEASE_SCRIPT = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    end
    return 0
  `;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /**
   * Runs `fn` while holding `key`, or returns `{ acquired: false }` at once if
   * someone else holds it. Callers decide whether to retry — for a queue job,
   * deferring is better than waiting and occupying a worker slot.
   */
  async withLock<T>(
    key: string,
    leaseMs: number,
    fn: () => Promise<T>,
  ): Promise<{ acquired: true; result: T } | { acquired: false }> {
    const token = randomToken();
    const redisKey = `lock:${key}`;

    let held: 'OK' | null = null;
    try {
      held = await this.redis.set(redisKey, token, 'PX', leaseMs, 'NX');
    } catch (error) {
      // Redis being unreachable must not stop the pipeline; falling through
      // unlocked restores the previous behaviour rather than dropping work.
      this.logger.warn(
        { key, err: error instanceof Error ? error.message : String(error) },
        'lock unavailable — proceeding without it',
      );
      return { acquired: true, result: await fn() };
    }
    if (held !== 'OK') return { acquired: false };

    try {
      return { acquired: true, result: await fn() };
    } finally {
      await this.redis
        .eval(ResourceLockService.RELEASE_SCRIPT, 1, redisKey, token)
        .catch((error: unknown) => {
          // The lease expires on its own, so a failed release only delays the
          // next turn; never let it mask the real outcome of `fn`.
          this.logger.warn(
            { key, err: error instanceof Error ? error.message : String(error) },
            'lock release failed — lease will expire',
          );
        });
    }
  }
}

/** Conversation-scoped key. Tenant-prefixed so ids cannot collide across tenants. */
export function conversationLockKey(tenantId: string, conversationId: string): string {
  return `conversation:${tenantId}:${conversationId}`;
}

function randomToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
