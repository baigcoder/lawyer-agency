import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../../config/env';

/**
 * WhatsApp expires a pairing QR after ~20s (the first one after ~60s), and
 * Evolution pushes each rotation via QRCODE_UPDATED. A QR older than this
 * means the rotations stopped arriving — usually a wrong EVOLUTION_SERVER_URL
 * so the webhook never reaches us — and showing it would only produce
 * "couldn't link device" on the phone.
 */
export const QR_MAX_AGE_MS = 30_000;

/**
 * QR relay for Evolution pairing. Evolution rotates pairing QRs on its own and
 * pushes each one via the QRCODE_UPDATED webhook; polling /instance/connect
 * instead would restart the Baileys handshake and kill in-flight scans. The
 * ingest service writes; the connection service reads.
 *
 * Kept in Redis so it survives an api restart and is shared by every api
 * replica — the webhook and the dashboard poll can land on different
 * processes. The key expires with the QR, so staleness needs no bookkeeping.
 * If Redis is unreachable it degrades to process memory rather than failing
 * the pairing screen.
 */
@Injectable()
export class EvolutionQrStore implements OnModuleDestroy {
  private readonly logger = new Logger(EvolutionQrStore.name);
  private readonly redis: Redis;
  private readonly memory = new Map<string, { qr: string; updatedAt: number }>();

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      // Fail fast: a dashboard poll must not hang waiting for Redis.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
    });
    this.redis.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async set(instanceName: string, qr: string | null): Promise<void> {
    if (!qr) return this.clear(instanceName);
    this.memory.set(instanceName, { qr, updatedAt: Date.now() });
    await this.connected()
      .then(() => this.redis.set(key(instanceName), qr, 'PX', QR_MAX_AGE_MS))
      .catch((error: unknown) => this.warn('set', error));
  }

  /** The current QR, or null when there is none or it has already expired. */
  async get(instanceName: string): Promise<string | null> {
    try {
      await this.connected();
      return await this.redis.get(key(instanceName));
    } catch (error) {
      this.warn('get', error);
      const entry = this.memory.get(instanceName);
      return entry && Date.now() - entry.updatedAt <= QR_MAX_AGE_MS ? entry.qr : null;
    }
  }

  async clear(instanceName: string): Promise<void> {
    this.memory.delete(instanceName);
    await this.connected()
      .then(() => this.redis.del(key(instanceName)))
      .catch((error: unknown) => this.warn('clear', error));
  }

  private async connected(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
  }

  private warn(op: string, error: unknown): void {
    this.logger.warn({ op, err: error instanceof Error ? error.message : String(error) }, 'QR store: Redis unavailable, using memory');
  }
}

function key(instanceName: string): string {
  return `evolution:qr:${instanceName}`;
}
