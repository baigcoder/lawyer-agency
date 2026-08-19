import { describe, expect, it, vi } from 'vitest';
import { SendService, type SendRequest } from './send.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import type { OutboundSender, WhatsappConnectionRepository } from './ports';

type TxMock = {
  conversation: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  whatsappTemplate: { findFirst: ReturnType<typeof vi.fn> };
  message: { create: ReturnType<typeof vi.fn> };
};

function makeService(overrides: {
  connection?: { status: 'disconnected' | 'connecting' | 'connected'; connectionType: 'baileys' | 'cloud_api' } | null;
  templateApproved?: boolean;
  windowOpen?: boolean;
} = {}) {
  const now = new Date();
  const windowExpires = overrides.windowOpen
    ? new Date(now.getTime() + 3_600_000) // open
    : new Date(now.getTime() - 3_600_000); // closed

  const tx: TxMock = {
    conversation: {
      findFirst: vi.fn(async () => ({
        id: 'conv-1',
        sessionWindowExpiresAt: windowExpires,
      })),
      update: vi.fn(async () => ({})),
    },
    whatsappTemplate: {
      findFirst: vi.fn(async () =>
        overrides.templateApproved ? { id: 'tpl-1', status: 'APPROVED' } : { id: 'tpl-1', status: 'DRAFT' },
      ),
    },
    message: { create: vi.fn(async () => ({ id: 'msg-1' })) },
  };

  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: TxMock) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;

  const sender: OutboundSender = {
    postMessage: vi.fn(async () => ({ wamid: 'wamid-1' })),
  };

  const conn = overrides.connection ?? null;
  const connections: WhatsappConnectionRepository = {
    findByTenant: vi.fn(async () =>
      conn === null
        ? null
        : {
            tenantId: 't1',
            instanceName: 'wakeel-t1',
            status: conn.status,
            connectionType: conn.connectionType,
            phoneNumber: null,
            displayName: null,
          },
    ),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };

  const service = new SendService(uow, sender, connections, {
    put: vi.fn(async (path: string) => ({ path })),
    get: vi.fn(),
    getUrl: vi.fn(),
  });
  return { service, sender, tx };
}

const baseText: SendRequest = {
  conversationId: 'conv-1',
  toWaPhone: '923000000001',
  senderType: 'AI',
  kind: 'text',
  body: 'hi',
};

describe('SendService', () => {
  it('sends freeform text inside the 24h window', async () => {
    const { service, sender } = makeService({ windowOpen: true });
    await service.send('t1', baseText);
    expect(sender.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ toWaPhone: '923000000001', body: { type: 'text', text: { body: 'hi' } } }),
    );
  });

  it('blocks freeform text outside the24h window on the official path (WindowClosedError)', async () => {
    const { service, sender } = makeService({ windowOpen: false, connection: null });
    await expect(service.send('t1', baseText)).rejects.toBeInstanceOf(WindowClosedError);
    expect(sender.postMessage).not.toHaveBeenCalled();
  });

  it('D-097: baileks-connected text skips the 24h window gate (carve-out)', async () => {
    const { service, sender } = makeService({
      windowOpen: false, // outside the window…
      connection: { status: 'connected', connectionType: 'baileys' }, // …but Baileys takes it
    });
    await service.send('t1', baseText);
    expect(sender.postMessage).toHaveBeenCalled(); // not blocked
  });

  it('keeps the window gate when Evolution is only connecting', async () => {
    const { service, sender } = makeService({
      windowOpen: false,
      connection: { status: 'connecting', connectionType: 'baileys' },
    });
    await expect(service.send('t1', baseText)).rejects.toBeInstanceOf(WindowClosedError);
    expect(sender.postMessage).not.toHaveBeenCalled();
  });

  it('keeps the window gate for Cloud API connections', async () => {
    const { service, sender } = makeService({
      windowOpen: false,
      connection: { status: 'connected', connectionType: 'cloud_api' },
    });
    await expect(service.send('t1', baseText)).rejects.toBeInstanceOf(WindowClosedError);
    expect(sender.postMessage).not.toHaveBeenCalled();
  });

  it('requires an APPROVED template for template sends', async () => {
    const { service, sender } = makeService({ templateApproved: false });
    await expect(
      service.send('t1', {
        ...baseText,
        kind: 'template',
        templateName: 'wakeel_welcome',
        language: 'en',
      }),
    ).rejects.toThrow();
    expect(sender.postMessage).not.toHaveBeenCalled();
  });

  it('sends a document as base64 with a file name', async () => {
    const { service, sender } = makeService({ windowOpen: true, connection: { status: 'connected', connectionType: 'baileys' } });
    await service.send('t1', {
      conversationId: 'conv-1',
      toWaPhone: '923000000001',
      senderType: 'SYSTEM',
      kind: 'document',
      caption: 'Payment confirmed',
      fileName: 'receipt-FAM-1.pdf',
      mimeType: 'application/pdf',
      documentBuffer: Buffer.from('%PDF-test'),
    });
    expect(sender.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          type: 'document',
          document: expect.objectContaining({ fileName: 'receipt-FAM-1.pdf', mimeType: 'application/pdf' }),
        }),
      }),
    );
  });
});
