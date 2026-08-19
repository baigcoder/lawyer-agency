import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Payment, Prisma } from '../../../generated/prisma/client';
import { PaymentsService } from './payments.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { PaymentRail } from './ports';
import { RailFactory } from './rail.factory';
import { RailUnavailableError } from '../domain/errors';

function mockUow() {
  const payments: Payment[] = [];
  const outbox: Array<{ tenantId: string; type: string; payload: unknown }> = [];

  const tx = {
    payment: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const p = {
          id: 'pay-' + (payments.length + 1),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Payment;
        payments.push(p);
        return p;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id) return payments.find((p) => p.id === where.id) ?? null;
        if (where.providerTxnId) return payments.find((p) => p.providerTxnId === where.providerTxnId) ?? null;
        if (typeof where.clientId === 'string') {
          const statuses = (where.status as { in?: string[] } | undefined)?.in;
          return (
            [...payments]
              .reverse()
              .find((p) => p.clientId === where.clientId && (!statuses || statuses.includes(p.status))) ?? null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = payments.find((p) => p.id === where.id);
        if (!p) throw new Error('not found');
        Object.assign(p, data, { updatedAt: new Date() });
        return p;
      }),
      findMany: vi.fn(async () => payments),
    },
  } as unknown as Prisma.TransactionClient;

  return {
    uow: {
      withPlatform: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
      withTenant: vi.fn(async <T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
    } as unknown as UnitOfWork,
    tx,
    payments,
    outbox,
  };
}

function mockOutbox(outbox: Array<{ tenantId: string; type: string; payload: unknown }>): OutboxWriter {
  return {
    append: vi.fn(async (_tx, tenantId, type, payload) => {
      outbox.push({ tenantId, type, payload });
    }),
  } as unknown as OutboxWriter;
}

function makeRail(): PaymentRail {
  return {
    method: 'STUB_ELECTRONIC',
    initiate: vi.fn(async () => ({
      providerTxnId: 'stub-txn-1',
      redirectUrl: 'https://example.com/pay',
      completed: false,
    })),
    parseWebhook: vi.fn((payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (typeof p.providerTxnId !== 'string') return null;
      return {
        providerTxnId: p.providerTxnId,
        status: p.status as 'SUCCESS' | 'FAILURE' | 'PENDING',
        paidAt: typeof p.paidAt === 'string' ? p.paidAt : undefined,
      };
    }),
  };
}

function makeFactory(rails: PaymentRail[], gateOpen: boolean): RailFactory {
  const config = {
    get: (k: string) => (k === 'PAYMENTS_ELECTRONIC_ENABLED' ? (gateOpen ? 'true' : undefined) : undefined),
  } as unknown as ConfigService<Env, true>;
  return new RailFactory(config, rails);
}

describe('PaymentsService', () => {
  it('requests an instruction payment without a merchant rail', async () => {
    const { uow, outbox } = mockUow();
    const rail = makeRail();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([rail], false));

    const result = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'JAZZCASH',
      returnUrl: 'https://firm.com/cb',
      description: 'Consultation appointment',
    });

    expect(result.status).toBe('PENDING');
    expect(result.redirectUrl).toBeUndefined();
    expect(rail.initiate).not.toHaveBeenCalled();
    expect(outbox[0]).toMatchObject({ type: 'payment.requested' });
  });

  it('requests an electronic payment and returns redirect', async () => {
    const { uow, outbox } = mockUow();
    const rail = makeRail();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([rail], true));

    const result = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'CARD_LOCAL',
      returnUrl: 'https://firm.com/cb',
    });

    expect(result.status).toBe('PENDING');
    expect(result.redirectUrl).toBe('https://example.com/pay');
    expect(rail.initiate).toHaveBeenCalled();
    expect(outbox[0]).toMatchObject({ type: 'payment.requested' });
  });

  it('records a manual payment synchronously', async () => {
    const { uow, outbox } = mockUow();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([], true));

    const result = await service.recordManualPayment('t1', {
      clientId: 'client-1',
      amountCents: 3000,
      currency: 'PKR',
      method: 'CASH',
      paidAt: new Date('2026-08-01T10:00:00Z'),
      recordedBy: 'user-1',
    });

    expect(result.status).toBe('RECORDED_MANUAL');
    expect(outbox.some((e) => e.type === 'payment.succeeded')).toBe(true);
  });

  it('reconciles a successful webhook', async () => {
    const { uow, outbox } = mockUow();
    const rail = makeRail();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([rail], true));

    const created = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'CARD_LOCAL',
      returnUrl: 'https://firm.com/cb',
    });

    const result = await service.processWebhook('t1', 'CARD_LOCAL', {
      providerTxnId: 'stub-txn-1',
      status: 'SUCCESS',
      paidAt: '2026-08-01T10:00:00Z',
    });

    expect(result.updated).toBe(true);
    const updated = await service.getById('t1', created.paymentId);
    expect(updated?.status).toBe('SUCCEEDED');
    expect(outbox.some((e) => e.type === 'payment.succeeded')).toBe(true);
  });

  it('refunds a succeeded payment', async () => {
    const { uow, outbox } = mockUow();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([], true));

    const manual = await service.recordManualPayment('t1', {
      clientId: 'client-1',
      amountCents: 3000,
      currency: 'PKR',
      method: 'CASH',
      paidAt: new Date('2026-08-01T10:00:00Z'),
      recordedBy: 'user-1',
    });

    const result = await service.refund('t1', manual.paymentId, 'user-1');
    expect(result.status).toBe('REFUNDED');
    expect(outbox.some((e) => e.type === 'payment.refunded')).toBe(true);
  });

  it('marks a pending instruction payment as received', async () => {
    const { uow, outbox } = mockUow();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([], false));
    const created = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'EASYPAISA',
      returnUrl: 'https://firm.com/cb',
    });
    const result = await service.confirmReceived('t1', created.paymentId, 'user-1');
    expect(result.status).toBe('RECORDED_MANUAL');
    expect(outbox.some((e) => e.type === 'payment.succeeded')).toBe(true);
  });

  it('attaches a screenshot proof to a pending payment', async () => {
    const { uow, outbox } = mockUow();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([], false));
    const created = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'JAZZCASH',
      returnUrl: 'https://firm.com/cb',
    });
    const updated = await service.attachProof('t1', created.paymentId, {
      documentId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d01',
      messageId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d02',
      conversationId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d03',
    });
    const meta = updated.metadata as Record<string, unknown>;
    expect(meta['proofDocumentId']).toBe('018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d01');
    expect(outbox.some((e) => e.type === 'payment.proof_received')).toBe(true);
  });

  it('throws when refunding a missing payment', async () => {
    const { uow } = mockUow();
    const service = new PaymentsService(uow, mockOutbox([]), makeFactory([], false));
    await expect(service.refund('t1', 'missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RailFactory legal gate (D-096)', () => {
  it('refuses card initiation when the gate is closed', async () => {
    const { uow } = mockUow();
    const service = new PaymentsService(uow, mockOutbox([]), makeFactory([makeRail()], false));
    await expect(
      service.requestPayment('t1', {
        clientId: 'client-1',
        amountCents: 50000,
        currency: 'PKR',
        method: 'CARD_LOCAL',
        returnUrl: 'https://firm.com/cb',
      }),
    ).rejects.toBeInstanceOf(RailUnavailableError);
  });

  it('still reconciles webhooks when the gate is closed', async () => {
    const { uow, outbox } = mockUow();
    const rail = makeRail();
    const service = new PaymentsService(uow, mockOutbox(outbox), makeFactory([rail], true));
    const created = await service.requestPayment('t1', {
      clientId: 'client-1',
      amountCents: 50000,
      currency: 'PKR',
      method: 'CARD_LOCAL',
      returnUrl: 'https://firm.com/cb',
    });
    const gated = new PaymentsService(uow, mockOutbox(outbox), makeFactory([rail], false));
    const result = await gated.processWebhook('t1', 'CARD_LOCAL', {
      providerTxnId: 'stub-txn-1',
      status: 'SUCCESS',
      paidAt: '2026-08-01T10:00:00Z',
    });
    expect(result.updated).toBe(true);
    const updated = await service.getById('t1', created.paymentId);
    expect(updated?.status).toBe('SUCCEEDED');
  });

  it('refuses when no rail adapter is registered even with the gate open', () => {
    const factory = makeFactory([], true);
    expect(() => factory.railForMethod('EASYPAISA')).toThrow(RailUnavailableError);
  });
});
