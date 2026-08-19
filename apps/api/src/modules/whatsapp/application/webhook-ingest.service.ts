import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { QUEUES } from '../../../common/queue/queue.constants';
import type { Env } from '../../../config/env';
import { InvalidWebhookSignatureError } from '../domain/errors';
import { normalizeMessage, templateStatusUpdateSchema, webhookPayloadSchema } from './dto';
import { WA_ROUTE_LOOKUP, type WaRouteLookup } from './ports';
import { TemplateSyncService } from './template-sync.service';

/**
 * Webhook ingestion (ADR-004/D-015): verify signature → resolve tenant →
 * persist raw event (unique externalEventId = idempotency anchor) → enqueue
 * normalized job → ack. Meta retries on non-200s, so every duplicate path
 * is handled explicitly rather than assumed away.
 */
@Injectable()
export class WebhookIngestService {
  private readonly logger = new Logger(WebhookIngestService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly crypto: CryptoService,
    private readonly uow: UnitOfWork,
    @Inject(WA_ROUTE_LOOKUP) private readonly routes: WaRouteLookup,
    @InjectQueue(QUEUES.WHATSAPP_INBOUND) private readonly inboundQueue: Queue,
    @InjectQueue(QUEUES.WHATSAPP_STATUS) private readonly statusQueue: Queue,
    private readonly templateSync: TemplateSyncService,
  ) {}

  /** GET verification handshake (Meta hub.challenge). */
  verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
    const expected = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (!expected) {
      // Required in prod (env validation); a dev boot without it is a misconfiguration.
      throw new ServiceUnavailableException('META_WEBHOOK_VERIFY_TOKEN is not configured');
    }
    if (mode !== 'subscribe' || token === undefined || challenge === undefined || token !== expected) {
      throw new UnauthorizedException('webhook verification failed');
    }
    return challenge;
  }

  /** POST ingestion. rawBody is required for HMAC — main.ts sets rawBody: true. */
  async ingest(rawBody: Buffer | undefined, signatureHeader: string | undefined, payload: unknown): Promise<void> {
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appSecret) {
      throw new ServiceUnavailableException('META_APP_SECRET is not configured');
    }
    if (!rawBody || !signatureHeader || !this.crypto.verifyHmacSha256(appSecret, rawBody, signatureHeader)) {
      throw new InvalidWebhookSignatureError();
    }

    const parsed = webhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      // Malformed payloads still ack (Meta would retry forever otherwise);
      // logged for inspection. Nothing to persist usefully.
      this.logger.warn({ issues: parsed.error.issues.length }, 'malformed webhook payload acked-and-dropped');
      return;
    }

    for (const entry of parsed.data.entry) {
      for (const change of entry.changes ?? []) {
        const { value } = change;
        const phoneNumberId = value.metadata.phone_number_id;
        const route = await this.routes.findByPhoneNumberId(phoneNumberId);
        if (!route) {
          // Not one of our tenants (or route row missing) — ack, log, move on.
          this.logger.warn({ phoneNumberId }, 'webhook for unknown phone_number_id');
          continue;
        }

        const displayName = value.contacts?.[0]?.profile?.name ?? null;

        for (const message of value.messages ?? []) {
          const normalized = normalizeMessage(message, displayName);
          const externalEventId = `${phoneNumberId}:${message.id}`;

          const inserted = await this.persistRawEvent(route.tenantId, phoneNumberId, externalEventId, value);
          if (!inserted) continue; // duplicate delivery — already handled

          await this.inboundQueue.add(
            'inbound',
            { tenantId: route.tenantId, message: normalized },
            {
              jobId: `wa-${message.id}`, // queue-level dedupe (second fence after the DB unique)
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 3600, count: 5000 },
              removeOnFail: false,
            },
          );
        }

        for (const status of value.statuses ?? []) {
          // Delivery receipts (sent/delivered/read) — FR-MSG-06.
          const inserted = await this.persistRawEvent(
            route.tenantId,
            phoneNumberId,
            `${phoneNumberId}:${status.id}:${status.status}`,
            value,
          );
          if (!inserted) continue;
          await this.statusQueue.add(
            'status',
            { tenantId: route.tenantId, status },
            {
              jobId: `wa-status-${status.id}-${status.status}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 3600, count: 5000 },
              removeOnFail: false,
            },
          );
        }

        // Template status updates arrive on the same webhook channel but with
        // a different shape (message_template_id). Apply directly; no queue
        // needed because the work is a single idempotent UPDATE.
        const templateUpdate = templateStatusUpdateSchema.safeParse(value);
        if (templateUpdate.success) {
          await this.templateSync.applyTemplateStatusUpdate(route.tenantId, {
            metaTemplateId: templateUpdate.data.message_template_id,
            status: templateUpdate.data.message_template_status,
            rejectionReason: templateUpdate.data.reason ?? null,
          });
        }
      }
    }
  }

  /** Returns true when the row was new (idempotency anchor, FR-MSG-01). */
  private async persistRawEvent(
    tenantId: string,
    phoneNumberId: string,
    externalEventId: string,
    value: unknown,
  ): Promise<boolean> {
    return this.uow.withPlatform(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO platform.webhook_events ("tenantId", "phoneNumberId", "externalEventId", payload)
        VALUES (${tenantId}::uuid, ${phoneNumberId}, ${externalEventId}, ${JSON.stringify(value)}::jsonb)
        ON CONFLICT ("externalEventId") DO NOTHING
        RETURNING id`;
      return rows.length === 1;
    });
  }

  /**
   * Retention trim: null out processed webhook payloads older than the given
   * age to reduce T2/T3 surface (schema comment, Phase 6b). The row and
   * idempotency anchor remain; only the payload blob is removed.
   */
  async trimProcessedPayloads(ageHours = 24): Promise<number> {
    return this.uow.withPlatform(async (tx) => {
      const cutoff = new Date(Date.now() - ageHours * 60 * 60 * 1000);
      const result = await tx.$executeRaw`
        UPDATE platform.webhook_events
        SET payload = NULL, "processedAt" = COALESCE("processedAt", now())
        WHERE status = 'PROCESSED'
          AND payload IS NOT NULL
          AND "receivedAt" < ${cutoff}
      `;
      return Number(result);
    });
  }
}
