import { Inject, Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { toInputJson } from '../../../common/persistence/json';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { rollSessionWindow } from '../../../common/messaging/window-policy';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../whatsapp/application/ports';
import type { Prisma, VoiceCallDisposition, VoiceCallStatus } from '../../../generated/prisma/client';
import { looksLikeWhatsappLid } from './normalize-call-event';

export interface VoiceCallRecord {
  id: string;
  conversationId: string;
  clientId: string;
  fromWaPhone: string;
  status: VoiceCallStatus;
}

@Injectable()
export class VoiceCallService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async ensureOpenConversation(
    tenantId: string,
    fromWaPhone: string,
  ): Promise<{ conversationId: string; clientId: string; fromWaPhone: string }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const waPhone = await resolveCallerPhone(tx, tenantId, fromWaPhone);
      const client = await tx.client.upsert({
        where: { tenantId_waPhone: { tenantId, waPhone } },
        create: { tenantId, waPhone },
        update: {},
      });
      const open = await tx.conversation.findFirst({
        where: { clientId: client.id, state: { not: 'CLOSED' } },
        orderBy: { lastClientMessageAt: 'desc' },
      });
      const now = new Date();
      if (open) {
        await tx.conversation.update({
          where: { id: open.id },
          data: {
            lastClientMessageAt: now,
            sessionWindowExpiresAt: rollSessionWindow(now),
          },
        });
        return { conversationId: open.id, clientId: client.id, fromWaPhone: waPhone };
      }
      const created = await tx.conversation.create({
        data: {
          tenantId,
          clientId: client.id,
          state: 'AI_ACTIVE',
          lastClientMessageAt: now,
          sessionWindowExpiresAt: rollSessionWindow(now),
        },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.ConversationCreated, {
        conversationId: created.id,
        clientId: client.id,
      });
      return { conversationId: created.id, clientId: client.id, fromWaPhone: waPhone };
    });
  }

  async startRinging(params: {
    tenantId: string;
    conversationId: string;
    providerCallId: string;
    fromWaPhone: string;
    instanceName: string;
  }): Promise<VoiceCallRecord> {
    return this.uow.withTenant(params.tenantId, async (tx) => {
      const existing = await tx.voiceCall.findUnique({
        where: {
          tenantId_providerCallId: {
            tenantId: params.tenantId,
            providerCallId: params.providerCallId,
          },
        },
      });
      if (existing) {
        const conversation = await tx.conversation.findFirst({ where: { id: existing.conversationId } });
        return {
          id: existing.id,
          conversationId: existing.conversationId,
          clientId: conversation?.clientId ?? '',
          fromWaPhone: existing.fromWaPhone,
          status: existing.status,
        };
      }
      const conversation = await tx.conversation.findFirst({ where: { id: params.conversationId } });
      if (!conversation) throw new Error('conversation not found for voice call');
      const created = await tx.voiceCall.create({
        data: {
          tenantId: params.tenantId,
          conversationId: params.conversationId,
          providerCallId: params.providerCallId,
          fromWaPhone: params.fromWaPhone,
          instanceName: params.instanceName,
          status: 'RINGING',
        },
      });
      await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.VoiceCallStarted, {
        voiceCallId: created.id,
        conversationId: created.conversationId,
      });
      return {
        id: created.id,
        conversationId: created.conversationId,
        clientId: conversation.clientId,
        fromWaPhone: created.fromWaPhone,
        status: created.status,
      };
    });
  }

  async markAnswered(tenantId: string, voiceCallId: string): Promise<void> {
    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.voiceCall.update({
        where: { id: voiceCallId },
        data: { status: 'ANSWERED', answeredAt: new Date() },
      });
    });
  }

  async complete(params: {
    tenantId: string;
    voiceCallId: string;
    status: Extract<VoiceCallStatus, 'REJECTED' | 'COMPLETED' | 'FAILED'>;
    disposition: VoiceCallDisposition;
    summary: string;
    transcript: string;
    appointmentId?: string | undefined;
    escalationId?: string | undefined;
  }): Promise<void> {
    await this.uow.withTenant(params.tenantId, async (tx) => {
      const call = await tx.voiceCall.findFirst({ where: { id: params.voiceCallId } });
      if (!call) return;
      if (call.status === 'COMPLETED' || call.status === 'REJECTED') return;

      const transcriptPath = params.transcript
        ? `tenants/${params.tenantId}/voice-calls/${call.id}.txt`
        : null;
      if (transcriptPath) {
        await this.storage.put(transcriptPath, Buffer.from(params.transcript, 'utf8'));
      }

      const now = new Date();
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - call.startedAt.getTime()) / 1000),
      );
      const inboxMessage = await tx.message.create({
        data: {
          tenantId: params.tenantId,
          conversationId: call.conversationId,
          direction: 'INBOUND',
          senderType: 'SYSTEM',
          contentType: 'CALL',
          body: params.summary,
          deliveryStatus: 'DELIVERED',
          payload: toInputJson({
            kind: 'voice_call',
            voiceCallId: call.id,
            durationSeconds,
            disposition: params.disposition,
            summary: params.summary,
          }),
          createdAt: now,
        },
      });

      await tx.voiceCall.update({
        where: { id: call.id },
        data: {
          status: params.status,
          disposition: params.disposition,
          summary: params.summary,
          transcriptPath,
          inboxMessageId: inboxMessage.id,
          appointmentId: params.appointmentId ?? null,
          escalationId: params.escalationId ?? null,
          endedAt: now,
        },
      });

      await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.VoiceCallCompleted, {
        voiceCallId: call.id,
        conversationId: call.conversationId,
        disposition: params.disposition,
      });
    });
  }
}

async function resolveCallerPhone(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fromWaPhone: string,
): Promise<string> {
  if (!looksLikeWhatsappLid(fromWaPhone)) return fromWaPhone;
  const recent = await tx.conversation.findFirst({
    where: {
      tenantId,
      lastClientMessageAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      client: { waPhone: { startsWith: '92' } },
    },
    orderBy: { lastClientMessageAt: 'desc' },
    select: { client: { select: { waPhone: true } } },
  });
  return recent?.client.waPhone ?? fromWaPhone;
}
