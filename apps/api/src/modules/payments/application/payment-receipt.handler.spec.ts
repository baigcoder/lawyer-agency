import { describe, expect, it, vi } from 'vitest';
import { PaymentReceiptHandler } from './payment-receipt.handler';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DocumentsService } from '../../documents/application/documents.service';
import { SendService } from '../../whatsapp/application/send.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventJob } from '../../../common/events/domain-event-handler.port';

function makeHandler(sendError?: Error) {
  const sent: unknown[] = [];
  const tx = {
    payment: {
      findFirst: vi.fn(async () => ({
        id: 'pay-1',
        clientId: 'client-1',
        caseId: null,
        amountCents: 300000,
        method: 'JAZZCASH',
        paidAt: new Date('2026-08-19T10:00:00Z'),
        description: 'Consultation appointment',
        metadata: { appointmentId: 'appt-1' },
        client: { id: 'client-1', name: 'Ayesha', waPhone: '923001234567' },
        case: null,
      })),
    },
    tenant: { findUnique: vi.fn(async () => ({ name: 'Talha Law', settings: { displayName: 'Talha Law Associates' } })) },
    appointment: {
      findFirst: vi.fn(async () => ({
        startsAt: new Date('2026-08-20T09:00:00Z'),
        lawyer: { user: { name: 'Talha Butt' } },
      })),
    },
    conversation: { findFirst: vi.fn(async () => ({ id: 'conv-1' })) },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const documents = {
    upload: vi.fn(async () => ({ id: 'doc-receipt', storagePath: 't1/receipt.pdf' })),
  } as unknown as DocumentsService;
  const send = {
    send: vi.fn(async (_t: string, req: unknown) => {
      if (sendError) throw sendError;
      sent.push(req);
      return { wamid: 'wamid-1' };
    }),
  } as unknown as SendService;
  return { handler: new PaymentReceiptHandler(uow, documents, send), sent, send, documents };
}

const job = {
  tenantId: 't1',
  type: DOMAIN_EVENTS.PaymentSucceeded,
  payload: { paymentId: 'pay-1', paidAt: '2026-08-19T10:00:00.000Z', amountCents: 300000 },
} as DomainEventJob;

describe('PaymentReceiptHandler', () => {
  it('uploads a PDF receipt and sends it on WhatsApp with appointment context', async () => {
    const { handler, sent, documents } = makeHandler();
    await handler.handle(job);
    expect(documents.upload).toHaveBeenCalledWith(expect.objectContaining({ docType: 'RECEIPT', mimeType: 'application/pdf' }));
    expect(sent[0]).toEqual(
      expect.objectContaining({
        kind: 'document',
        fileName: expect.stringContaining('receipt-'),
        caption: expect.stringContaining('Appointment:'),
      }),
    );
  });

  it('does not throw when the 24h window is closed', async () => {
    const { handler, send } = makeHandler(new WindowClosedError());
    await expect(handler.handle(job)).resolves.toBeUndefined();
    expect(send.send).toHaveBeenCalled();
  });
});
