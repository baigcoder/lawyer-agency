import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { QUEUES } from '../../../common/queue/queue.constants';
import type { Env } from '../../../config/env';
import type { NormalizedInboundMessage } from '../../../common/messaging/inbound-message';
import { InvalidWebhookSignatureError } from '../domain/errors';
import { WHATSAPP_CONNECTION_REPOSITORY, type WhatsappConnectionRepository } from './ports';
import { EvolutionQrStore } from './evolution-qr.store';
import { Inject } from '@nestjs/common';

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data?: unknown;
  sender?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function phoneFromOwnerJid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const phone = value.split('@')[0]?.replace(/\D/g, '');
  return phone && phone.length >= 7 ? phone : undefined;
}

interface EvolutionMessageKey {
  remoteJid?: string;
  remoteJidAlt?: string;
  senderPn?: string;
  participantAlt?: string;
  fromMe?: boolean;
  id?: string;
}

interface EvolutionMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; mimetype?: string; fileName?: string };
  documentMessage?: { caption?: string; mimetype?: string; fileName?: string; title?: string };
  videoMessage?: { caption?: string; mimetype?: string; fileName?: string };
  audioMessage?: { caption?: string; mimetype?: string; seconds?: number; ptt?: boolean };
  pttMessage?: { mimetype?: string; seconds?: number };
  [key: string]: unknown;
}

/** Evolution v2 sends `MESSAGES_UPSERT`; older builds send `messages.upsert`. */
export function canonicalizeEvolutionEvent(event: string | undefined): string {
  return (event ?? '').toLowerCase().replace(/_/g, '.');
}

/**
 * Evolution webhook ingestion. Unlike Meta, Evolution sends one event per
 * instance; the instance name maps directly to the tenant's connection row.
 * Signature is checked via x-evolution-secret header.
 */
@Injectable()
export class EvolutionWebhookIngestService {
  private readonly logger = new Logger(EvolutionWebhookIngestService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly uow: UnitOfWork,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
    private readonly qrStore: EvolutionQrStore,
    @InjectQueue(QUEUES.WHATSAPP_INBOUND) private readonly inboundQueue: Queue,
    @InjectQueue(QUEUES.WHATSAPP_STATUS) private readonly statusQueue: Queue,
  ) {}

  async ingest(
    signatureHeader: string | undefined,
    payload: EvolutionWebhookPayload,
  ): Promise<{ received: true }> {
    const expected = this.config.get('EVOLUTION_WEBHOOK_SECRET', { infer: true });
    if (!expected) {
      throw new UnauthorizedException('EVOLUTION_WEBHOOK_SECRET is not configured');
    }
    if (signatureHeader !== expected) {
      throw new InvalidWebhookSignatureError();
    }

    if (!payload.instance) {
      this.logger.warn('evolution webhook missing instance name');
      return { received: true };
    }

    const tenantId = await this.resolveTenantByInstance(payload.instance);
    if (!tenantId) {
      this.logger.warn({ instance: payload.instance }, 'evolution webhook for unknown instance');
      return { received: true };
    }

    const event = canonicalizeEvolutionEvent(payload.event);
    this.logger.log({ event, rawEvent: payload.event, instance: payload.instance }, 'evolution webhook received');
    if (event === 'messages.upsert') {
      const records = collectInboundRecords(payload.data);
      if (records.length === 0) {
        this.logger.warn({ instance: payload.instance }, 'messages.upsert webhook had no message records');
      }
      for (const record of records) {
        await this.handleMessageUpsert(tenantId, payload.instance, record, payload.sender);
      }
    } else if (event === 'connection.update') {
      const data = asRecord(payload.data) ?? {};
      await this.handleConnectionUpdate(tenantId, payload.instance, data);
    } else if (event === 'qrcode.updated') {
      const data = asRecord(payload.data) ?? {};
      const qr = asRecord(data['qrcode']);
      const base64 = qr && typeof qr['base64'] === 'string' ? (qr['base64'] as string) : null;
      const code = qr && typeof qr['code'] === 'string' ? (qr['code'] as string) : null;
      this.qrStore.set(payload.instance, base64 ?? code);
    }

    return { received: true };
  }

  private async handleMessageUpsert(
    tenantId: string,
    instanceName: string,
    data: Record<string, unknown>,
    payloadSender?: string,
  ): Promise<void> {
    const key = (data.key ?? {}) as EvolutionMessageKey;
    if (key.fromMe) {
      this.logger.debug({ instance: instanceName }, 'ignoring own outbound echo');
      return;
    }
    const message = unwrapWhatsappMessage((data.message ?? {}) as EvolutionMessage);
    const normalized = normalizeEvolutionMessage(key, message, data, payloadSender);
    if (!normalized) {
      this.logger.warn(
        { instance: instanceName, key, messageType: Object.keys(message) },
        'evolution message could not be normalized — dropped',
      );
      return;
    }

    await this.inboundQueue.add(
      'inbound',
      { tenantId, message: normalized },
      {
        jobId: `evo-${instanceName}-${normalized.wamid}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: false,
      },
    );
  }

  private async handleConnectionUpdate(
    tenantId: string,
    instanceName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const instanceState = asRecord(data.instance)?.state;
    const state = String(data.state ?? data.connection ?? data.connectionStatus ?? instanceState ?? 'disconnected').toLowerCase();
    const status: 'connected' | 'connecting' | 'disconnected' =
      state === 'open' || state === 'connected'
        ? 'connected'
        : state === 'connecting'
          ? 'connecting'
          : 'disconnected';
    if (status === 'connected') this.qrStore.clear(instanceName);
    const phoneNumber =
      typeof data.phoneNumber === 'string'
        ? data.phoneNumber
        : phoneFromOwnerJid(data.ownerJid ?? data.wuid);
    const displayName = typeof data.profileName === 'string' ? data.profileName : undefined;
    await this.uow.withTenant(tenantId, async (tx) => {
      await this.connections.upsert(tx, tenantId, {
        status,
        ...(phoneNumber ? { phoneNumber } : {}),
        ...(displayName ? { displayName } : {}),
      });
    });
  }

  private async resolveTenantByInstance(instanceName: string): Promise<string | null> {
    return this.uow.withPlatform(async (tx) => {
      const row = await tx.whatsappConnection.findUnique({ where: { instanceName }, select: { tenantId: true } });
      return row?.tenantId ?? null;
    });
  }
}

export function collectInboundRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.flatMap((item) => {
      const row = asRecord(item);
      return row ? [row] : [];
    });
  }
  const record = asRecord(data);
  if (!record) return [];
  if (Array.isArray(record['messages'])) {
    return record['messages'].flatMap((item) => {
      const row = asRecord(item);
      return row ? [row] : [];
    });
  }
  return [record];
}

export function unwrapWhatsappMessage(message: EvolutionMessage): EvolutionMessage {
  const nested =
    asRecord(message['ephemeralMessage'])?.['message'] ??
    asRecord(message['viewOnceMessage'])?.['message'] ??
    asRecord(message['viewOnceMessageV2'])?.['message'] ??
    asRecord(message['viewOnceMessageV2Extension'])?.['message'] ??
    asRecord(message['documentWithCaptionMessage'])?.['message'] ??
    asRecord(message['editedMessage'])?.['message'];
  const inner = asRecord(nested);
  if (!inner) return message;
  return unwrapWhatsappMessage(inner as EvolutionMessage);
}

export function phoneFromEvolutionSender(
  key: EvolutionMessageKey,
  data: Record<string, unknown>,
  payloadSender?: string,
): string | undefined {
  const jid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  if (
    jid.endsWith('@g.us') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@broadcast') ||
    jid === 'status@broadcast'
  ) {
    return undefined;
  }
  const candidates = [
    key.remoteJidAlt,
    key.senderPn,
    key.participantAlt,
    data['senderPn'],
    data['sender'],
    payloadSender,
    jid.includes('@lid') ? undefined : jid,
  ];
  for (const candidate of candidates) {
    const phone = phoneFromOwnerJid(candidate);
    if (phone) return phone;
  }
  return undefined;
}

/** Pure normalizer — exported for unit tests and webhook ingest. */
export function normalizeEvolutionMessage(
  key: EvolutionMessageKey,
  message: EvolutionMessage,
  data: Record<string, unknown>,
  payloadSender?: string,
): NormalizedInboundMessage | null {
    const unwrapped = unwrapWhatsappMessage(message);
    const from = phoneFromEvolutionSender(key, data, payloadSender);
    if (!from || !key.id) return null;

    const hasAudio = Boolean(unwrapped.audioMessage ?? unwrapped.pttMessage);
    const hasImage = Boolean(unwrapped.imageMessage);
    const hasDocument = Boolean(unwrapped.documentMessage);
    const hasVideo = Boolean(unwrapped.videoMessage);
    const caption =
      unwrapped.imageMessage?.caption ??
      unwrapped.documentMessage?.caption ??
      unwrapped.videoMessage?.caption ??
      null;
    const text =
      (typeof unwrapped.conversation === 'string' && unwrapped.conversation) ||
      (typeof unwrapped.extendedTextMessage?.text === 'string' && unwrapped.extendedTextMessage.text) ||
      caption ||
      null;

    let contentType: NormalizedInboundMessage['contentType'] = 'OTHER';
    if (hasAudio) contentType = 'AUDIO';
    else if (hasImage) contentType = 'IMAGE';
    else if (hasDocument) contentType = 'DOCUMENT';
    else if (hasVideo) contentType = 'VIDEO';
    else if (text) contentType = 'TEXT';
    else return null;

    const hasMedia = hasAudio || hasImage || hasDocument || hasVideo;
    const mediaFilename =
      unwrapped.documentMessage?.fileName ??
      unwrapped.documentMessage?.title ??
      unwrapped.imageMessage?.fileName ??
      unwrapped.videoMessage?.fileName ??
      null;
    const mediaMimeType =
      unwrapped.audioMessage?.mimetype ??
      unwrapped.pttMessage?.mimetype ??
      unwrapped.documentMessage?.mimetype ??
      unwrapped.imageMessage?.mimetype ??
      unwrapped.videoMessage?.mimetype ??
      null;
    const mediaSeconds = unwrapped.audioMessage?.seconds ?? unwrapped.pttMessage?.seconds ?? null;

    const timestampRaw = Number(data.messageTimestamp ?? Date.now() / 1000);
    const timestampMs = timestampRaw > 1e12 ? timestampRaw : timestampRaw * 1000;
    const pushName = typeof data['pushName'] === 'string' ? data['pushName'] : null;

    return {
      wamid: key.id,
      fromWaPhone: from,
      fromDisplayName: pushName,
      contentType,
      body: hasAudio ? null : text,
      mediaId: hasMedia ? key.id : null,
      payload: {
        ...data,
        ...(mediaFilename ? { mediaFilename } : {}),
        ...(mediaMimeType ? { mediaMimeType } : {}),
        ...(typeof mediaSeconds === 'number' ? { seconds: mediaSeconds } : {}),
      },
      sentAt: new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now()),
    };
}
