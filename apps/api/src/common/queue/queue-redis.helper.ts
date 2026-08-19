import type { Queue } from 'bullmq';
import type { RedisQueueBackend } from 'bullmq';

/** Result of {@link queueRedisClient}: a redis client with string commands. */
export interface RawRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, durationSec: number): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<string | null>;
  del(key: string): Promise<number>;
  /** Pattern scan for boot-time discovery (pilot resume markers). */
  keys(pattern: string): Promise<string[]>;
}

/**
 * Raw Redis access for a BullMQ queue (BullMQ v6 exposes it via backend).
 * Used for short-lived keys (pilot QR codes) rather than the queue itself.
 */
export async function queueRedisClient(queue: Queue): Promise<RawRedisClient> {
  const backend: RedisQueueBackend = (queue as unknown as { backend: RedisQueueBackend }).backend;
  return (await backend.client) as unknown as RawRedisClient;
}
