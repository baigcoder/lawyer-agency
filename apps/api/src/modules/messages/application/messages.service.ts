import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { toInputJson } from '../../../common/persistence/json';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { QUEUES } from '../../../common/queue/queue.constants';
import { rollSessionWindow } from '../../../common/messaging/window-policy';
import type { NormalizedInboundMessage } from '../../../common/messaging/inbound-message';
import type { WaStatus } from '../../whatsapp/application/dto';

export interface RecordInboundResult {
  conversationId: string;
  messageId: string;
  duplicate: boolean;
}

const STATUS_MAP: Record<WaStatus['status'], 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/** Inbound types processed asynchronously before AI sees them (STT or document filing). */
const DEFER_AI_UNTIL_MEDIA = new Set(['AUDIO', 'IMAGE', 'DOCUMENT', 'VIDEO']);
const MEDIA_CONTENT_TYPES = DEFER_AI_UNTIL_MEDIA;

const STATUS_RANK = { READ: 4, DELIVERED: 3, SENT: 2, FAILED: 1, QUEUED: 0 } as const;

type DeliveryStatus = keyof typeof STATUS_RANK;

export function computeStatusTransition(
  current: DeliveryStatus,
  incomingStatus: WaStatus['status'],
): { newStatus: DeliveryStatus; updated: boolean } | null {
  const newStatus = STATUS_MAP[incomingStatus];
  if (current === 'FAILED' && newStatus !== 'FAILED') return null; // terminal
  if (newStatus === 'FAILED') return { newStatus, updated: true }; // can fail from any state
  const currentRank = STATUS_RANK[current] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;
  if (newRank <= currentRank) return null;
  return { newStatus: newStatus as DeliveryStatus, updated: true };
}

function readAiAutoReplyEnabled(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return true;
  const value = (settings as Record<string, unknown>)['aiAutoReplyEnabled'];
  return typeof value === 'boolean' ? value : true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Conversation state + message persistence (FR-MSG-01/03/06). Idempotent on
 * wamid: retries from queue or Meta collapse onto the stored row. The 24h
 * window rolls from the client's message timestamp (D-003).
 *
 * Language detection (FR-MSG-05) is applied by the AI router (Phase 7),
 * which updates messages.languageDetected — ingest stores UNKNOWN.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    @InjectQueue(QUEUES.WHATSAPP_MEDIA) private readonly mediaQueue: Queue,
  ) {}

  async recordInbound(tenantId: string, message: NormalizedInboundMessage): Promise<RecordInboundResult> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.message.findFirst({ where: { wamid: message.wamid } });
      if (existing) {
        return { conversationId: existing.conversationId, messageId: existing.id, duplicate: true };
      }

      const client = await tx.client.upsert({
        where: { tenantId_waPhone: { tenantId, waPhone: message.fromWaPhone } },
        create: {
          tenantId,
          waPhone: message.fromWaPhone,
          name: message.fromDisplayName,
        },
        update: message.fromDisplayName ? { name: message.fromDisplayName } : {},
      });

      const open = await tx.conversation.findFirst({
        where: { clientId: client.id, state: { not: 'CLOSED' } },
        orderBy: { lastClientMessageAt: 'desc' },
      });

      const windowExpires = rollSessionWindow(message.sentAt);
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      const aiAutoReplyEnabled = readAiAutoReplyEnabled(tenant?.settings);
      const conversationState = aiAutoReplyEnabled ? 'AI_ACTIVE' : 'HUMAN_REQUIRED';

      const conversation = open
        ? await tx.conversation.update({
            where: { id: open.id },
            data: {
              lastClientMessageAt: message.sentAt,
              sessionWindowExpiresAt: windowExpires,
              state: open.state === 'CLOSED' ? conversationState : open.state,
            },
          })
        : await tx.conversation.create({
            data: {
              tenantId,
              clientId: client.id,
              state: conversationState,
              lastClientMessageAt: message.sentAt,
              sessionWindowExpiresAt: windowExpires,
            },
          });

      const isNewConversation = !open;

      if (isNewConversation) {
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.ConversationCreated, {
          conversationId: conversation.id,
          clientId: client.id,
        });
      }

      const priorSettings = asRecord(tenant?.settings);
      const payloadSource = asRecord(message.payload)?.['source'];
      let settingsChanged = false;
      const settingsPatch: Record<string, unknown> = { ...priorSettings };
      if (payloadSource === 'test-inbound' && !priorSettings['setupTestSentAt']) {
        settingsPatch['setupTestSentAt'] = new Date().toISOString();
        settingsChanged = true;
      } else if (payloadSource !== 'test-inbound' && !priorSettings['firstClientMessageAt']) {
        settingsPatch['firstClientMessageAt'] = new Date().toISOString();
        settingsChanged = true;
      }
      if (settingsChanged) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { settings: toInputJson(settingsPatch) },
        });
      }

      const stored = await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          senderType: 'CLIENT',
          wamid: message.wamid,
          contentType: message.contentType,
          body: message.body,
          payload: toInputJson(message.payload),
          deliveryStatus: 'DELIVERED',
          createdAt: message.sentAt,
        },
      });

      if (aiAutoReplyEnabled && !DEFER_AI_UNTIL_MEDIA.has(message.contentType)) {
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.MessageInboundReceived, {
          conversationId: conversation.id,
          messageId: stored.id,
          clientId: client.id,
          contentType: message.contentType,
        });
      }

      if (MEDIA_CONTENT_TYPES.has(message.contentType)) {
        await this.mediaQueue.add(
          'media',
          { tenantId, messageId: stored.id, clientId: client.id, mediaId: message.mediaId },
          {
            jobId: `wa:media:${message.wamid}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 3600, count: 2000 },
            removeOnFail: false,
          },
        );
      }

      return { conversationId: conversation.id, messageId: stored.id, duplicate: false };
    });
  }

  /**
   * Apply a Meta delivery status update to the matching outbound message row.
   * We ignore updates for unknown wamids (likely race: inbound persisted first,
   * or a status for another tenant's message). We also ignore downgrades:
   * READ > DELIVERED > SENT > FAILED; FAILED is terminal and should not be
   * overwritten by later success receipts.
   */
  async applyStatusUpdate(tenantId: string, status: WaStatus): Promise<{ updated: boolean }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const message = await tx.message.findFirst({ where: { wamid: status.id } });
      if (!message) return { updated: false };

      const transition = computeStatusTransition(message.deliveryStatus as DeliveryStatus, status.status);
      if (!transition) return { updated: false };

      await tx.message.update({
        where: { id_createdAt: { id: message.id, createdAt: message.createdAt } },
        data: { deliveryStatus: transition.newStatus },
      });
      return { updated: true };
    });
  }
}
