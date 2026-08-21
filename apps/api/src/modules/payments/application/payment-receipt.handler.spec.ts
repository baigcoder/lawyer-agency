import { describe, expect, it, vi } from 'vitest';
import { PaymentReceiptHandler, resolveAppointmentForPayment } from './payment-receipt.handler';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DocumentsService } from '../../documents/application/documents.service';
import { SendService } from '../../whatsapp/application/send.service';
import { AppointmentNotificationsService } from '../../appointments/application/appointment-notifications.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventJob } from '../../../common/events/domain-event-handler.port';

function makeHandler(opts: { sendError?: Error; appointmentId?: string | null; nearest?: boolean } = {}) {
  const sent: unknown[] = [];
  const appointmentRow = {
    id: 'appt-1',
    clientId: 'client-1',
    lawyerId: 'lawyer-1',
    caseId: null,
    startsAt: new Date('2026-08-20T09:00:00Z'),
    endsAt: new Date('2026-08-20T09:30:00Z'),
    status: 'CONFIRMED',
    location: 'Lahore office',
    notes: null,
    reminderSentAt: null,
    lawyer: { user: { name: 'Talha Butt' } },
    client: { name: 'Ayesha', waPhone: '923001234567' },
  };
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
        metadata: opts.appointmentId === null ? {} : { appointmentId: opts.appointmentId ?? 'appt-1' },
        client: { id: 'client-1', name: 'Ayesha', waPhone: '923001234567' },
        case: null,
      })),
    },
    tenant: { findUnique: vi.fn(async () => ({ name: 'Talha Law', settings: { displayName: 'Talha Law Associates' } })) },
    appointment: {
      findFirst: vi.fn(async (args: { where?: { id?: string } }) => {
        if (opts.nearest && !args.where?.id) return appointmentRow;
        if (args.where?.id === 'appt-1' || opts.appointmentId === 'appt-1' || opts.appointmentId === undefined) {
          return appointmentRow;
        }
        return null;
      }),
    },
    conversation: { findFirst: vi.fn(async () => ({ id: 'conv-1' })) },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const documents = {
    upload: vi.fn(async (input: { filename: string }) => ({
      id: `doc-${input.filename}`,
      storagePath: `t1/${input.filename}`,
    })),
  } as unknown as DocumentsService;
  const send = {
    send: vi.fn(async (_t: string, req: unknown) => {
      if (opts.sendError) throw opts.sendError;
      sent.push(req);
      return { wamid: 'wamid-1' };
    }),
  } as unknown as SendService;
  const appointmentNotifications = {
    sendConfirmation: vi.fn(async () => true),
  } as unknown as AppointmentNotificationsService;
  return {
    handler: new PaymentReceiptHandler(uow, documents, send, appointmentNotifications),
    sent,
    send,
    documents,
    appointmentNotifications,
    tx,
  };
}

const job = {
  tenantId: 't1',
  type: DOMAIN_EVENTS.PaymentSucceeded,
  payload: { paymentId: 'pay-1', paidAt: '2026-08-19T10:00:00.000Z', amountCents: 300000 },
} as DomainEventJob;

describe('PaymentReceiptHandler', () => {
  it('uploads a PDF receipt and sends it on WhatsApp with appointment context', async () => {
    const { handler, sent, documents, appointmentNotifications } = makeHandler();
    await handler.handle(job);
    expect(documents.upload).toHaveBeenCalledWith(expect.objectContaining({ docType: 'RECEIPT', mimeType: 'application/pdf' }));
    expect(sent[0]).toEqual(
      expect.objectContaining({
        kind: 'document',
        fileName: expect.stringContaining('receipt-'),
        caption: expect.stringContaining('Appointment:'),
      }),
    );
    expect(sent[1]).toEqual(
      expect.objectContaining({
        kind: 'document',
        fileName: expect.stringContaining('appointment-'),
        caption: expect.stringContaining('Appointment confirmed'),
      }),
    );
    expect(appointmentNotifications.sendConfirmation).toHaveBeenCalledOnce();
  });

  it('resolves nearest upcoming appointment when metadata lacks appointmentId', async () => {
    const { handler, appointmentNotifications, tx } = makeHandler({ appointmentId: null, nearest: true });
    await handler.handle(job);
    expect(tx.appointment.findFirst).toHaveBeenCalled();
    expect(appointmentNotifications.sendConfirmation).toHaveBeenCalledOnce();
  });

  it('does not throw when the 24h window is closed', async () => {
    const { handler, send } = makeHandler({ sendError: new WindowClosedError() });
    await expect(handler.handle(job)).resolves.toBeUndefined();
    expect(send.send).toHaveBeenCalled();
  });
});

describe('resolveAppointmentForPayment', () => {
  it('prefers linked appointmentId over nearest upcoming', async () => {
    const linked = {
      id: 'appt-linked',
      clientId: 'client-1',
      lawyerId: 'l1',
      caseId: null,
      startsAt: new Date('2026-09-01T10:00:00Z'),
      endsAt: new Date('2026-09-01T10:30:00Z'),
      status: 'PENDING',
      location: null,
      notes: null,
      reminderSentAt: null,
      lawyer: { user: { name: 'Ali' } },
      client: { name: 'Sara', waPhone: '92300' },
    };
    const tx = {
      appointment: {
        findFirst: vi.fn(async (args: { where?: { id?: string } }) => (args.where?.id === 'appt-linked' ? linked : null)),
      },
    };
    const result = await resolveAppointmentForPayment(tx, { clientId: 'client-1', appointmentId: 'appt-linked' });
    expect(result?.id).toBe('appt-linked');
    expect(result?.lawyerName).toBe('Ali');
  });
});
