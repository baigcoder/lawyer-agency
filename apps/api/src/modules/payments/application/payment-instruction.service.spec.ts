import { describe, expect, it, vi } from 'vitest';
import { PaymentInstructionService } from './payment-instruction.service';
import { PaymentsService } from './payments.service';
import { PaymentDetailsService } from '../../firm-profile/application/payment-details.service';
import { SendService } from '../../whatsapp/application/send.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Prisma } from '../../../generated/prisma/client';

function makeService(opts: {
  details?: { jazzcashNumber?: string };
  openPayment?: { id: string; amountCents: number; currency: string; description: string | null; status: string } | null;
  feePkr?: number;
  sendError?: Error;
}) {
  const sent: unknown[] = [];
  const requested: unknown[] = [];
  const proofs: unknown[] = [];
  const tx = {
    conversation: {
      findFirst: vi.fn(async () => ({ id: 'conv-1', client: { waPhone: '923001234567' } })),
    },
    tenant: {
      findUnique: vi.fn(async () => ({ settings: { consultationFeePkr: opts.feePkr ?? 0 } })),
    },
  } as unknown as Prisma.TransactionClient;
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (inner: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const paymentDetails = {
    getDecrypted: vi.fn(async () => ({
      jazzcashNumber: opts.details?.jazzcashNumber ?? '03001234567',
      easypaisaNumber: '',
      bankName: '',
      accountTitle: '',
      accountNumber: '',
      iban: '',
    })),
  } as unknown as PaymentDetailsService;
  const send = {
    send: vi.fn(async (_tenant: string, req: unknown) => {
      if (opts.sendError) throw opts.sendError;
      sent.push(req);
      return { wamid: 'wamid-1' };
    }),
  } as unknown as SendService;
  const payments = {
    findOpenForClient: vi.fn(async () => opts.openPayment ?? null),
    requestPayment: vi.fn(async (_t: string, input: unknown) => {
      requested.push(input);
      return { paymentId: 'pay-new', status: 'PENDING' };
    }),
    attachProof: vi.fn(async (_t: string, paymentId: string, proof: unknown) => {
      proofs.push({ paymentId, proof });
      return {};
    }),
  } as unknown as PaymentsService;
  return {
    service: new PaymentInstructionService(uow, paymentDetails, send, payments),
    sent,
    requested,
    proofs,
    payments,
    send,
  };
}

describe('PaymentInstructionService', () => {
  it('resends instructions when a pending payment already exists', async () => {
    const { service, sent, requested } = makeService({
      openPayment: {
        id: 'pay-1',
        amountCents: 300000,
        currency: 'PKR',
        description: 'Consultation appointment',
        status: 'PENDING',
      },
    });
    const handled = await service.handleClientRequest('t1', { clientId: 'client-1' });
    expect(handled).toBe(true);
    expect(requested).toHaveLength(0);
    expect(sent[0]).toEqual(
      expect.objectContaining({
        kind: 'text',
        body: expect.stringContaining('JazzCash: 03001234567'),
      }),
    );
  });

  it('creates a consultation-fee payment when none is open', async () => {
    const { service, requested, sent } = makeService({ feePkr: 2500, openPayment: null });
    const handled = await service.handleClientRequest('t1', { clientId: 'client-1' });
    expect(handled).toBe(true);
    expect(requested[0]).toEqual(expect.objectContaining({ amountCents: 250000, method: 'JAZZCASH' }));
    expect(sent).toHaveLength(0);
  });

  it('swallows WindowClosedError when acknowledging a screenshot', async () => {
    const { service, proofs } = makeService({
      openPayment: {
        id: 'pay-1',
        amountCents: 10000,
        currency: 'PKR',
        description: null,
        status: 'PENDING',
      },
      sendError: new WindowClosedError(),
    });
    const attached = await service.attachProofIfPending('t1', {
      clientId: 'client-1',
      documentId: 'doc-1',
      messageId: 'msg-1',
      conversationId: 'conv-1',
    });
    expect(attached).toBe(true);
    expect(proofs).toHaveLength(1);
  });
});
