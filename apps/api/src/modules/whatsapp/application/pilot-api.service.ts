import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { RateLimitError, SlidingWindowRateLimiter } from '../../../common/rate-limiter';
import { PILOT_DISCONNECT_JOB, PILOT_PAIR_JOB, QUEUES } from '../../../common/queue/queue.constants';
import { queueRedisClient } from '../../../common/queue/queue-redis.helper';
import { MessagesService } from '../../messages/application/messages.service';
import { PilotAllowlistTooLargeError, PilotNumberNotAllowlistedError } from '../domain/errors';
import { PILOT_SESSION_REPOSITORY, type PilotAllowlistEntry, type PilotSessionRepository } from './ports';

export const pilotPairResponseSchema = z.object({
  status: z.enum(['PAIRING', 'PAIRED', 'EXPIRED', 'DISCONNECTED']),
  expiresAt: z.string().datetime().nullable(),
});

export const pilotQrSchema = z.object({ qr: z.string().nullable() });

export const pilotStatusSchema = z.object({
  status: z.enum(['PAIRING', 'PAIRED', 'EXPIRED', 'DISCONNECTED']),
  allowlist: z.array(
    z.object({ number: z.string(), label: z.string().nullable() }),
  ),
  expiresAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  /** Terminal failure reason (handshake exhausted / revoked link), if any. */
  lastError: z.string().nullable(),
  lastErrorAt: z.string().datetime().nullable(),
  /** True when the worker-role bridge heartbeat is fresh (A10). */
  bridgeAlive: z.boolean(),
});

/** Accepts "digits" or "+digits" (A9 normalization) with an optional label. */
const allowlistEntrySchema = z.object({
  number: z
    .string()
    .transform((n) => n.replace(/^\+/, ''))
    .pipe(z.string().regex(/^\d{7,15}$/, 'E.164 digits without +')),
  label: z.string().trim().max(60).nullish().transform((l) => l ?? null),
});

export const pilotAllowlistSchema = z.object({
  entries: z.array(allowlistEntrySchema).min(1).max(500),
});

export const pilotAllowlistResponseSchema = z.object({
  allowlist: z.array(z.object({ number: z.string(), label: z.string().nullable() })),
});

export const pilotTestInboundSchema = z.object({
  fromWaPhone: z
    .string()
    .transform((n) => n.replace(/^\+/, ''))
    .pipe(z.string().regex(/^\d{7,15}$/, 'Enter a valid phone number')),
  body: z.string().trim().min(1).max(500),
});

export const pilotTestInboundResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

const aliveRedisKey = (tenantId: string) => `wakeel:pilot:alive:${tenantId}`;

/**
 * API-side pilot bridge surface (D-092). Pairing/disconnecting are jobs on
 * the WHATSAPP_PILOT queue (the Baileys socket lives in the worker role);
 * the QR code is written to Redis by the bridge and read back here, and the
 * bridge publishes a liveness heartbeat the status endpoint surfaces (A10).
 */
@Injectable()
export class PilotApiService {
  /** A12: pairing tears down and rebuilds a Baileys socket — cap the churn. */
  private readonly pairLimiter = new SlidingWindowRateLimiter(10, 60_000);
  /** QR is polled by the dashboard (~10/min) — generous but bounded. */
  private readonly qrLimiter = new SlidingWindowRateLimiter(120, 60_000);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService<Env, true>,
    @Inject(PILOT_SESSION_REPOSITORY) private readonly pilots: PilotSessionRepository,
    @InjectQueue(QUEUES.WHATSAPP_PILOT) private readonly pilotQueue: Queue,
    private readonly messages: MessagesService,
  ) {}

  async pair(tenantId: string): Promise<z.infer<typeof pilotPairResponseSchema>> {
    if (!this.pairLimiter.allow(tenantId)) {
      throw new RateLimitError('pair', this.pairLimiter.retryAfterSeconds(tenantId));
    }
    const ttlHours = this.config.get('PILOT_SESSION_TTL_HOURS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    const session = await this.uow.withTenant(tenantId, async (tx) => {
      await this.pilots.upsert(tx, tenantId, { status: 'PAIRING', expiresAt, lastSeenAt: null });
      return this.pilots.findByTenant(tx, tenantId);
    });

    // Remove any stale job with the same deterministic jobId so BullMQ
    // actually enqueues a fresh pair attempt instead of silently deduping.
    const pairJobId = `pilot-pair-${tenantId}`;
    const oldJob = await this.pilotQueue.getJob(pairJobId);
    if (oldJob) await oldJob.remove().catch(() => {});

    await this.pilotQueue.add(
      PILOT_PAIR_JOB,
      { tenantId },
      { jobId: pairJobId, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 5000 } },
    );

    return {
      status: session?.status ?? 'PAIRING',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async qr(tenantId: string): Promise<z.infer<typeof pilotQrSchema>> {
    if (!this.qrLimiter.allow(tenantId)) {
      throw new RateLimitError('QR polling', this.qrLimiter.retryAfterSeconds(tenantId));
    }
    const client = await queueRedisClient(this.pilotQueue);
    const raw = await client.get(`wakeel:pilot:qr:${tenantId}`);
    return { qr: raw ?? null };
  }

  async status(tenantId: string): Promise<z.infer<typeof pilotStatusSchema>> {
    const session = await this.uow.withTenant(tenantId, async (tx) =>
      this.pilots.findByTenant(tx, tenantId),
    );
    if (!session) throw new NotFoundException('No pilot session yet — pair first');

    // Any live-but-unpaired session past its TTL is EXPIRED for the UI (A4
    // fix: previously only PAIRED sessions were checked, so stale PAIRING
    // rows reported PAIRING forever).
    const expired = session.expiresAt <= new Date() && session.status !== 'DISCONNECTED';
    const aliveRaw = await (async () => {
      try {
        const client = await queueRedisClient(this.pilotQueue);
        return await client.get(aliveRedisKey(tenantId));
      } catch {
        return null;
      }
    })();

    return {
      status: expired ? 'EXPIRED' : session.status,
      allowlist: session.allowlist,
      expiresAt: session.expiresAt.toISOString(),
      lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
      lastError: session.lastError,
      lastErrorAt: session.lastErrorAt?.toISOString() ?? null,
      bridgeAlive: aliveRaw !== null,
    };
  }

  async setAllowlist(
    tenantId: string,
    entries: Array<{ number: string; label?: string | null }>,
  ): Promise<z.infer<typeof pilotAllowlistResponseSchema>> {
    const max = this.config.get('PILOT_MAX_ALLOWLIST', { infer: true });
    if (entries.length > max) {
      throw new PilotAllowlistTooLargeError(max, entries.length);
    }
    // Dedupe by number, last write wins for the label (A9).
    const byNumber = new Map<string, PilotAllowlistEntry>();
    for (const entry of entries) {
      byNumber.set(entry.number, { number: entry.number, label: entry.label ?? null });
    }
    const allowlist = [...byNumber.values()];
    await this.uow.withTenant(tenantId, async (tx) => {
      await this.pilots.upsert(tx, tenantId, { allowlist });
    });
    return { allowlist };
  }

  /**
   * Simulate an inbound message from an allowlisted number. This lets a firm
   * test the AI reply without pulling out their phone. The message is recorded
   * exactly like a real inbound message, so the AI pipeline (domain event →
   * orchestrator → outbound reply) runs end-to-end.
   */
  async testInbound(
    tenantId: string,
    input: { fromWaPhone: string; body: string },
  ): Promise<z.infer<typeof pilotTestInboundResponseSchema>> {
    const session = await this.uow.withTenant(tenantId, async (tx) =>
      this.pilots.findByTenant(tx, tenantId),
    );
    if (!session || session.status !== 'PAIRED') {
      throw new NotFoundException('Pilot bridge is not paired');
    }
    if (!session.allowlist.some((entry) => entry.number === input.fromWaPhone)) {
      throw new PilotNumberNotAllowlistedError();
    }

    const normalized = {
      wamid: `pilot:test:${randomUUID()}`,
      fromWaPhone: input.fromWaPhone,
      fromDisplayName: 'Test client',
      contentType: 'TEXT' as const,
      body: input.body,
      mediaId: null,
      payload: {},
      sentAt: new Date(),
    };

    const result = await this.messages.recordInbound(tenantId, normalized);
    return { conversationId: result.conversationId, messageId: result.messageId };
  }

  async disconnect(tenantId: string): Promise<{ status: 'DISCONNECTED' }> {
    await this.pilotQueue.add(
      PILOT_DISCONNECT_JOB,
      { tenantId },
      { jobId: `pilot-disconnect-${tenantId}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 5000 } },
    );
    return { status: 'DISCONNECTED' };
  }
}
