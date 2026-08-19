import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Conversation, Prisma } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { SendService } from '../../whatsapp/application/send.service';
import type { UsersService } from '../../users/application/users.service';
import type { OutboxWriter } from '../../../common/events/outbox-writer';
import type { MediaReadService } from '../../whatsapp/application/media-read.service';
import { InboxService, playbackMimeType } from './inbox.service';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    tenantId: 't1',
    clientId: 'client-1',
    caseId: null,
    assignedToId: null,
    state: 'AI_ACTIVE',
    language: 'UNKNOWN',
    sessionWindowExpiresAt: new Date(Date.now() + 60_000),
    disclosedAt: null,
    lastClientMessageAt: new Date('2026-08-01T10:00:00Z'),
    lastOutboundAt: null,
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:00Z'),
    ...overrides,
  };
}

function mockUow(rows: Conversation[]) {
  const messages: Array<{
    id: string;
    conversationId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    senderType: string;
    senderUserId: string | null;
    body: string | null;
    contentType: string;
    deliveryStatus: string;
    createdAt: Date;
    senderUser?: { id: string; name: string } | null;
  }> = [];

  const tx = {
    conversation: {
      findMany: vi.fn(async (args?: { orderBy?: Record<string, 'asc' | 'desc'>; take?: number }) => {
        let ordered = [...rows];
        if (args?.orderBy?.lastClientMessageAt) {
          const dir = args.orderBy.lastClientMessageAt === 'asc' ? 1 : -1;
          ordered.sort((a, b) =>
            ((a.lastClientMessageAt?.getTime() ?? 0) - (b.lastClientMessageAt?.getTime() ?? 0)) * dir,
          );
        }
        if (args?.take) ordered = ordered.slice(0, args.take);
        return ordered.map((r) => ({
          ...r,
          client: { id: r.clientId, name: 'Client Name', waPhone: '923001234567' },
          case: null,
          assignedTo: r.assignedToId ? { id: r.assignedToId, name: 'Assignee' } : null,
          messages: messages
            .filter((m) => m.conversationId === r.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 1),
        }));
      }),
      findFirst: vi.fn(async ({ where }: { where: { id?: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) return null;
        return {
          ...row,
          client: { id: row.clientId, name: 'Client Name', waPhone: '923001234567' },
          case: null,
          assignedTo: row.assignedToId ? { id: row.assignedToId, name: 'Assignee' } : null,
          messages: messages
            .filter((m) => m.conversationId === row.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 100)
            .map((m) => ({ ...m, senderUser: m.senderUser ?? null })),
        };
      }),
      update: vi.fn(async (args: { data: Partial<Conversation>; where: { id: string } }) => {
        const row = rows.find((r) => r.id === args.where.id);
        if (!row) return row;
        Object.assign(row, args.data);
        return row;
      }),
    },
    message: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        messages.filter((m) => {
          if (where.conversationId && m.conversationId !== where.conversationId) return false;
          if (where.direction && m.direction !== where.direction) return false;
          if (
            where.createdAt &&
            typeof where.createdAt === 'object' &&
            where.createdAt !== null &&
            'gt' in (where.createdAt as object) &&
            m.createdAt <= ((where.createdAt as { gt: Date }).gt)
          )
            return false;
          return true;
        }).length,
      ),
      findFirst: vi.fn(async () => null),
    },
    document: {
      count: vi.fn(async () => 0),
    },
    payment: {
      findMany: vi.fn(async () => []),
    },
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id === 'user-1') return { id: 'user-1', name: 'Staff User', status: 'ACTIVE', role: { name: 'Staff' } };
        return null;
      }),
    },
  } as unknown as Prisma.TransactionClient;

  return {
    uow: {
      withPlatform: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
      withTenant: vi.fn(async <T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
    } as unknown as UnitOfWork,
    tx,
    messages,
  };
}

function makeInboxService(
  uow: UnitOfWork,
  send: SendService,
  users: UsersService = { listActive: vi.fn(async () => []) } as unknown as UsersService,
  media: MediaReadService = {
    getBuffer: vi.fn(async () => Buffer.from('audio-bytes')),
  } as unknown as MediaReadService,
) {
  return new InboxService(
    uow,
    send,
    users,
    { create: vi.fn() } as never,
    { record: vi.fn(async () => {}) } as never,
    { append: vi.fn(async () => {}) } as unknown as OutboxWriter,
    media,
  );
}

describe('InboxService', () => {
  it('lists conversations sorted by last client message', async () => {
    const rows = [
      makeConversation({ id: 'conv-1', lastClientMessageAt: new Date('2026-08-01T10:00:00Z') }),
      makeConversation({ id: 'conv-2', lastClientMessageAt: new Date('2026-08-01T11:00:00Z') }),
    ];
    const { uow } = mockUow(rows);
    const service = makeInboxService(uow, {} as SendService);

    const result = await service.listConversations('t1', {}, undefined);
    expect(result[0].id).toBe('conv-2');
    expect(result[1].id).toBe('conv-1');
  });

  it('filters by state', async () => {
    const rows = [
      makeConversation({ id: 'conv-1', state: 'AI_ACTIVE' }),
      makeConversation({ id: 'conv-2', state: 'HUMAN_REQUIRED' }),
    ];
    const { uow, tx } = mockUow(rows);
    const service = makeInboxService(uow, {} as SendService);

    await service.listConversations('t1', { state: 'HUMAN_REQUIRED' }, undefined);
    expect(tx.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ state: 'HUMAN_REQUIRED' }) }),
    );
  });

  it('filters unassigned', async () => {
    const rows = [
      makeConversation({ id: 'conv-1', assignedToId: 'user-1' }),
      makeConversation({ id: 'conv-2', assignedToId: null }),
    ];
    const { uow, tx } = mockUow(rows);
    const service = makeInboxService(uow, {} as SendService);

    await service.listConversations('t1', { unassigned: true }, undefined);
    expect(tx.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedToId: null }) }),
    );
  });

  it('assigns a conversation', async () => {
    const rows = [makeConversation({ id: 'conv-1' })];
    const { uow, tx } = mockUow(rows);
    const service = makeInboxService(uow, {} as SendService);

    await service.assignConversation('t1', 'conv-1', 'user-1');
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedToId: 'user-1' } }),
    );
  });

  it('throws when assigning a missing conversation', async () => {
    const { uow } = mockUow([]);
    const service = makeInboxService(uow, {} as SendService);

    await expect(service.assignConversation('t1', 'missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('transitions state', async () => {
    const rows = [makeConversation({ id: 'conv-1', state: 'AI_ACTIVE' })];
    const { uow, tx } = mockUow(rows);
    const service = makeInboxService(uow, {} as SendService);

    await service.transitionState('t1', 'conv-1', 'HUMAN_ACTIVE');
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'HUMAN_ACTIVE' } }),
    );
  });

  it('sends a manual reply', async () => {
    const rows = [makeConversation({ id: 'conv-1' })];
    const { uow } = mockUow(rows);
    const send = { send: vi.fn(async () => ({ wamid: 'wamid-reply' })) } as unknown as SendService;
    const service = makeInboxService(uow, send, { listActive: vi.fn(async () => []) } as UsersService);

    const result = await service.reply('t1', 'conv-1', { body: 'Hello', senderUserId: 'user-1' });
    expect(send.send).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ kind: 'text', body: 'Hello', senderType: 'STAFF' }),
    );
    expect(result.wamid).toBe('wamid-reply');
  });

  it('streams voice media from object storage with an audio mime type', async () => {
    const { uow, tx } = mockUow([]);
    const getBuffer = vi.fn(async () => Buffer.from('ogg-bytes'));
    (tx.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'msg-audio',
      payload: { mediaPath: 'tenants/t1/media/msg-audio.ogg', mimeType: 'audio/ogg' },
    });
    const service = makeInboxService(uow, {} as SendService, undefined, {
      getBuffer,
    } as unknown as MediaReadService);

    const media = await service.streamMessageMedia('t1', 'msg-audio');
    expect(getBuffer).toHaveBeenCalledWith(
      't1',
      'tenants/t1/media/msg-audio.ogg',
      {
        mediaPath: 'tenants/t1/media/msg-audio.ogg',
        mimeType: 'audio/ogg',
      },
      expect.objectContaining({ fromMe: false }),
    );
    expect(media.mimeType).toBe('audio/ogg; codecs=opus');
    expect(media.contentLength).toBe(9);
  });

  it('throws when the stored voice file is missing', async () => {
    const { uow, tx } = mockUow([]);
    (tx.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'msg-audio',
      payload: { mediaPath: 'tenants/t1/media/missing.ogg', mimeType: 'audio/ogg' },
    });
    const service = makeInboxService(uow, {} as SendService, undefined, {
      getBuffer: vi.fn(async () => {
        throw new Error('ENOENT');
      }),
    } as unknown as MediaReadService);

    await expect(service.streamMessageMedia('t1', 'msg-audio')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('playbackMimeType', () => {
  it('labels WhatsApp opus notes so the browser can play them', () => {
    expect(playbackMimeType('audio/ogg', 'tenants/t1/media/a.ogg')).toBe('audio/ogg; codecs=opus');
    expect(playbackMimeType('application/octet-stream', 'tenants/t1/media/a.ogg')).toBe(
      'audio/ogg; codecs=opus',
    );
  });
});
