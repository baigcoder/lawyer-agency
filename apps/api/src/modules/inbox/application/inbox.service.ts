import { Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { ConversationState } from '../../../generated/prisma/client';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';
import { SendService } from '../../whatsapp/application/send.service';
import { UsersService } from '../../users/application/users.service';
import { CasesService } from '../../cases/application/cases.service';
import { AuditService } from '../../audit/application/audit.service';
import { MediaReadService } from '../../whatsapp/application/media-read.service';
import { readAudioSeconds } from '../../../common/messaging/audio-seconds';

export interface InboxPendingPayment {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  proofMessageId: string | null;
  proofDocumentId: string | null;
}

export interface InboxConversationSummary {
  id: string;
  state: ConversationState;
  client: { id: string; name: string | null; waPhone: string };
  case: { id: string; reference: string } | null;
  assignedTo: { id: string; name: string } | null;
  lastMessage: { body: string | null; senderType: string; contentType: string; createdAt: Date } | null;
  unreadCount: number;
  sessionWindowExpiresAt: Date | null;
  lastClientMessageAt: Date | null;
  updatedAt: Date;
  documentCount: number;
  pendingDraft: { messageId: string; body: string } | null;
  pendingPayment: InboxPendingPayment | null;
}

export interface InboxMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: string;
  senderName: string | null;
  body: string | null;
  contentType: string;
  deliveryStatus: string;
  mediaUrl: string | null;
  mediaDurationSeconds: number | null;
  documentId: string | null;
  pendingApproval: boolean;
  createdAt: Date;
}

export interface InboxFilters {
  state?: ConversationState | undefined;
  assignedToMe?: boolean | undefined;
  unassigned?: boolean | undefined;
  q?: string | undefined;
}

export interface ReplyInput {
  body: string;
  senderUserId: string;
}

/**
 * Inbox read model + handoff commands for the dashboard (Phase 11, D-018).
 * Keeps conversation/message reads close to the domain tables; a dedicated
 * CQRS projection can be introduced later if the list query becomes hot.
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly send: SendService,
    private readonly users: UsersService,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxWriter,
    private readonly media: MediaReadService,
  ) {}

  async listConversations(
    tenantId: string,
    filters: InboxFilters,
    currentUserId?: string,
  ): Promise<InboxConversationSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const where: NonNullable<Parameters<typeof tx.conversation.findMany>[0]>['where'] = {};
      if (filters.state) where.state = filters.state;
      if (filters.assignedToMe && currentUserId) where.assignedToId = currentUserId;
      if (filters.unassigned) where.assignedToId = null;

      const rows = await tx.conversation.findMany({
        where,
        include: {
          client: true,
          case: { select: { id: true, reference: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { lastClientMessageAt: 'desc' },
        take: 200,
      });

      const clientIds = [...new Set(rows.map((row) => row.clientId))];
      const pendingByClient = await loadPendingPaymentsByClient(tx, clientIds);

      const summaries = await Promise.all(
        rows.map(async (row) => {
          const latest = row.messages[0] ?? null;
          const unreadWhere: NonNullable<Parameters<typeof tx.message.count>[0]>['where'] = {
            conversationId: row.id,
            direction: 'INBOUND',
          };
          if (row.lastOutboundAt) {
            unreadWhere.createdAt = { gt: row.lastOutboundAt };
          }
          const unreadCount = await tx.message.count({ where: unreadWhere });
          const documentCount = await tx.document.count({
            where: { clientId: row.clientId },
          });

          return {
            id: row.id,
            state: row.state,
            client: { id: row.client.id, name: row.client.name, waPhone: row.client.waPhone },
            case: row.case,
            assignedTo: row.assignedTo,
            lastMessage: latest
              ? {
                  body: latest.body,
                  senderType: latest.senderType,
                  contentType: latest.contentType,
                  createdAt: latest.createdAt,
                }
              : null,
            unreadCount,
            sessionWindowExpiresAt: row.sessionWindowExpiresAt,
            lastClientMessageAt: row.lastClientMessageAt,
            updatedAt: row.updatedAt,
            documentCount,
            pendingDraft: null,
            pendingPayment: pendingByClient.get(row.clientId) ?? null,
          };
        }),
      );

      if (!filters.q) return summaries;
      const term = filters.q.toLowerCase();
      return summaries.filter(
        (s) =>
          (s.client.name?.toLowerCase().includes(term) ?? false) ||
          s.client.waPhone.includes(term) ||
          (s.lastMessage?.body?.toLowerCase().includes(term) ?? false),
      );
    });
  }

  async getConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<{ conversation: InboxConversationSummary; messages: InboxMessage[] }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const row = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: {
          client: true,
          case: { select: { id: true, reference: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { senderUser: { select: { id: true, name: true } } },
          },
        },
      });
      if (!row) throw new NotFoundException('conversation not found');

      const latest = row.messages[0] ?? null;
      const unreadWhere: NonNullable<Parameters<typeof tx.message.count>[0]>['where'] = {
        conversationId: row.id,
        direction: 'INBOUND',
      };
      if (row.lastOutboundAt) {
        unreadWhere.createdAt = { gt: row.lastOutboundAt };
      }
      const unreadCount = await tx.message.count({ where: unreadWhere });
      const documentCount = await tx.document.count({ where: { clientId: row.clientId } });
      const draft = await tx.message.findFirst({
        where: {
          conversationId: row.id,
          direction: 'OUTBOUND',
          senderType: 'AI',
          deliveryStatus: 'QUEUED',
        },
        orderBy: { createdAt: 'desc' },
      });
      const draftPayload = draft ? asPayloadRecord(draft.payload) : {};
      const pendingDraft =
        draft && draftPayload['pendingApproval'] === true && draft.body
          ? { messageId: draft.id, body: draft.body }
          : null;

      const messages: InboxMessage[] = [...row.messages].reverse().map((m) => this.mapMessage(m, row.client));

      const pendingByClient = await loadPendingPaymentsByClient(tx, [row.clientId]);
      const conversation: InboxConversationSummary = {
        id: row.id,
        state: row.state,
        client: { id: row.client.id, name: row.client.name, waPhone: row.client.waPhone },
        case: row.case,
        assignedTo: row.assignedTo,
        lastMessage: latest
          ? {
              body: latest.body,
              senderType: latest.senderType,
              contentType: latest.contentType,
              createdAt: latest.createdAt,
            }
          : null,
        unreadCount,
        sessionWindowExpiresAt: row.sessionWindowExpiresAt,
        lastClientMessageAt: row.lastClientMessageAt,
        updatedAt: row.updatedAt,
        documentCount,
        pendingDraft,
        pendingPayment: pendingByClient.get(row.clientId) ?? null,
      };

      return { conversation, messages };
    });
  }

  async listMessages(
    tenantId: string,
    conversationId: string,
    options: { before?: Date | undefined; limit?: number | undefined },
  ): Promise<InboxMessage[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation) throw new NotFoundException('conversation not found');

      const rows = await tx.message.findMany({
        where: {
          conversationId,
          ...(options.before ? { createdAt: { lt: options.before } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { senderUser: { select: { id: true, name: true } } },
      });

      return [...rows].reverse().map((m) => this.mapMessage(m, conversation.client));
    });
  }

  async streamMessageMedia(
    tenantId: string,
    messageId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; contentLength: number }> {
    const row = await this.uow.withTenant(tenantId, async (tx) => {
      return tx.message.findFirst({
        where: { id: messageId },
        include: { conversation: { select: { client: { select: { waPhone: true } } } } },
      });
    });
    if (!row) throw new NotFoundException('message not found');
    const payload = asPayloadRecord(row.payload);
    const mediaPath =
      (typeof payload['mediaPath'] === 'string' ? payload['mediaPath'] : null) ??
      (typeof payload['audioPath'] === 'string' ? payload['audioPath'] : null);
    if (!mediaPath) throw new NotFoundException('message has no media');
    const storedMime = typeof payload['mimeType'] === 'string' ? payload['mimeType'] : 'application/octet-stream';
    let buffer: Buffer;
    try {
      buffer = await this.media.getBuffer(tenantId, mediaPath, payload, {
        wamid: row.wamid,
        fromMe: row.direction === 'OUTBOUND',
        waPhone: row.conversation?.client?.waPhone ?? null,
      });
    } catch {
      throw new NotFoundException('media file not found');
    }
    return {
      stream: Readable.from(buffer),
      mimeType: playbackMimeType(storedMime, mediaPath),
      contentLength: buffer.length,
    };
  }

  private mapMessage(
    m: {
      id: string;
      direction: string;
      senderType: string;
      body: string | null;
      contentType: string;
      deliveryStatus: string;
      payload: unknown;
      createdAt: Date;
      senderUser?: { name: string } | null;
    },
    client: { name: string | null; waPhone: string },
  ): InboxMessage {
    const payload = asPayloadRecord(m.payload);
    const mediaPath =
      (typeof payload['mediaPath'] === 'string' ? payload['mediaPath'] : null) ??
      (typeof payload['audioPath'] === 'string' ? payload['audioPath'] : null);
    const hasDocument = typeof payload['documentId'] === 'string';
    return {
      id: m.id,
      direction: m.direction as InboxMessage['direction'],
      senderType: m.senderType,
      senderName:
        m.senderType === 'CLIENT'
          ? client.name ?? client.waPhone
          : m.senderType === 'AI'
            ? 'AI'
            : m.senderUser?.name ?? m.senderType,
      body: m.body,
      contentType: m.contentType,
      deliveryStatus: m.deliveryStatus,
      mediaUrl: mediaPath || hasDocument ? `/backend/v1/inbox/messages/${m.id}/media` : null,
      mediaDurationSeconds: readAudioSeconds(payload),
      documentId: hasDocument ? (payload['documentId'] as string) : null,
      pendingApproval: payload['pendingApproval'] === true,
      createdAt: m.createdAt,
    };
  }

  async assignConversation(
    tenantId: string,
    conversationId: string,
    assigneeUserId: string | null,
  ): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({ where: { id: conversationId } });
      if (!conversation) throw new NotFoundException('conversation not found');

      if (assigneeUserId) {
        const user = await tx.user.findFirst({ where: { id: assigneeUserId, status: 'ACTIVE' } });
        if (!user) throw new NotFoundException('assignee not found');
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: { assignedToId: assigneeUserId },
      });
    });
  }

  async transitionState(
    tenantId: string,
    conversationId: string,
    state: ConversationState,
  ): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({ where: { id: conversationId } });
      if (!conversation) throw new NotFoundException('conversation not found');
      const from = conversation.state;
      if (from === state) return;
      await tx.conversation.update({ where: { id: conversationId }, data: { state } });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.ConversationStateChanged, {
        conversationId,
        from,
        to: state,
      });
    });
  }

  async reply(
    tenantId: string,
    conversationId: string,
    input: ReplyInput,
  ): Promise<{ messageId: string; wamid: string }> {
    const { clientWaPhone, senderType } = await this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation) throw new NotFoundException('conversation not found');

      const sender = await tx.user.findFirst({
        where: { id: input.senderUserId, status: 'ACTIVE' },
        include: { role: true },
      });
      if (!sender) throw new NotFoundException('sender not found');

      return {
        clientWaPhone: conversation.client.waPhone,
        senderType: (sender.role.name === 'Lawyer' ? 'LAWYER' : 'STAFF') as 'LAWYER' | 'STAFF',
      };
    });

    const result = await this.send.send(tenantId, {
      kind: 'text',
      conversationId,
      toWaPhone: clientWaPhone,
      senderType,
      body: input.body,
    });

    await this.uow.withTenant(tenantId, async (tx) => {
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.StaffMessageSent, {
        conversationId,
        messageId: result.wamid,
      });
    });

    return { messageId: result.wamid, wamid: result.wamid };
  }

  async convertToCase(
    tenantId: string,
    conversationId: string,
    input: { matterType: string; urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' },
  ): Promise<{ caseId: string; reference: string }> {
    const ctx = await this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation) throw new NotFoundException('conversation not found');
      if (conversation.caseId) {
        const existing = await tx.case.findFirst({ where: { id: conversation.caseId } });
        if (existing) return { existing: true as const, caseId: existing.id, reference: existing.reference };
      }
      return { existing: false as const, clientId: conversation.clientId, conversationId: conversation.id };
    });

    if (ctx.existing) {
      return { caseId: ctx.caseId, reference: ctx.reference };
    }

    const created = await this.cases.create(tenantId, {
      clientId: ctx.clientId,
      matterType: input.matterType,
      urgency: input.urgency ?? 'NORMAL',
      summary: null,
      intakeData: {},
    });

    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.conversation.update({
        where: { id: ctx.conversationId },
        data: { caseId: created.id },
      });
    });

    return { caseId: created.id, reference: created.reference };
  }

  async listNotes(tenantId: string, conversationId: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.conversationNote.findMany({
        where: { conversationId },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((r) => ({
        id: r.id,
        body: r.body,
        author: { id: r.author.id, name: r.author.name },
        createdAt: r.createdAt,
      }));
    });
  }

  async addNote(tenantId: string, conversationId: string, authorId: string, body: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({ where: { id: conversationId } });
      if (!conversation) throw new NotFoundException('conversation not found');
      const row = await tx.conversationNote.create({
        data: { tenantId, conversationId, authorId, body },
        include: { author: { select: { id: true, name: true } } },
      });
      return {
        id: row.id,
        body: row.body,
        author: { id: row.author.id, name: row.author.name },
        createdAt: row.createdAt,
      };
    });
  }

  async approveDraft(tenantId: string, conversationId: string, messageId: string, editorUserId: string): Promise<void> {
    const ctx = await this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { client: true },
      });
      if (!conversation) throw new NotFoundException('conversation not found');

      const draft = await tx.message.findFirst({ where: { id: messageId, conversationId } });
      if (!draft?.body) throw new NotFoundException('draft not found');

      return {
        body: draft.body,
        clientWaPhone: conversation.client.waPhone,
      };
    });

    await this.send.send(tenantId, {
      kind: 'text',
      conversationId,
      toWaPhone: ctx.clientWaPhone,
      senderType: 'STAFF',
      body: ctx.body,
    });

    await this.uow.withTenant(tenantId, async (tx) => {
      const draft = await tx.message.findFirst({ where: { id: messageId } });
      if (!draft) return;
      await tx.message.update({
        where: { id_createdAt: { id: draft.id, createdAt: draft.createdAt } },
        data: {
          deliveryStatus: 'SENT',
          senderUserId: editorUserId,
          payload: toInputJson({ ...asPayloadRecord(draft.payload), pendingApproval: false }),
        },
      });
    });
  }

  async rejectDraft(tenantId: string, conversationId: string, messageId: string): Promise<void> {
    await this.uow.withTenant(tenantId, async (tx) => {
      const draft = await tx.message.findFirst({ where: { id: messageId, conversationId } });
      if (!draft) throw new NotFoundException('draft not found');
      await tx.message.update({
        where: { id_createdAt: { id: draft.id, createdAt: draft.createdAt } },
        data: {
          deliveryStatus: 'FAILED',
          payload: toInputJson({ ...asPayloadRecord(draft.payload), pendingApproval: false, rejected: true }),
        },
      });
    });
  }
}

function asPayloadRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** WhatsApp PTT is OGG/Opus; browsers need an audio/* type, not octet-stream. */
export function playbackMimeType(stored: string, path: string): string {
  const lower = stored.toLowerCase();
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (lower.includes('ogg') || lower.includes('opus') || ext === 'ogg') {
    return lower.includes('codecs') ? stored : 'audio/ogg; codecs=opus';
  }
  if (lower.startsWith('audio/') || lower.startsWith('image/') || lower.startsWith('video/') || lower.startsWith('application/pdf')) {
    return stored;
  }
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'm4a' || ext === 'mp4') return ext === 'm4a' ? 'audio/mp4' : stored;
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  return stored || 'application/octet-stream';
}

function mapPendingPayment(row: {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  metadata: unknown;
}): InboxPendingPayment {
  const meta = asPayloadRecord(row.metadata);
  return {
    id: row.id,
    amountCents: row.amountCents,
    currency: row.currency,
    description: row.description,
    proofMessageId: typeof meta['proofMessageId'] === 'string' ? meta['proofMessageId'] : null,
    proofDocumentId: typeof meta['proofDocumentId'] === 'string' ? meta['proofDocumentId'] : null,
  };
}

async function loadPendingPaymentsByClient(
  tx: {
    payment: {
      findMany: (args: {
        where: { clientId: { in: string[] }; status: { in: ['PENDING', 'REQUESTED'] } };
        orderBy: { createdAt: 'desc' };
      }) => Promise<
        Array<{
          id: string;
          clientId: string;
          amountCents: number;
          currency: string;
          description: string | null;
          metadata: unknown;
        }>
      >;
    };
  },
  clientIds: string[],
): Promise<Map<string, InboxPendingPayment>> {
  const map = new Map<string, InboxPendingPayment>();
  if (clientIds.length === 0) return map;
  const rows = await tx.payment.findMany({
    where: { clientId: { in: clientIds }, status: { in: ['PENDING', 'REQUESTED'] } },
    orderBy: { createdAt: 'desc' },
  });
  for (const row of rows) {
    if (map.has(row.clientId)) continue;
    map.set(row.clientId, mapPendingPayment(row));
  }
  return map;
}
