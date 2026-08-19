import { describe, expect, it, vi } from 'vitest';
import { WhatsappUpgradeService } from './whatsapp-upgrade.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { PaymentsService } from '../../payments/application/payments.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

function makeService(overrides: {
  feature?: { status: string; expiresAt?: Date } | null;
  payment?: { id: string; status: string; description: string | null } | null;
} = {}) {
  const config = {
    get: (k: keyof Env) => {
      if (k === 'OFFICIAL_WHATSAPP_PRICE_CENTS') return 50000;
      if (k === 'OFFICIAL_WHATSAPP_CURRENCY') return 'PKR';
      return undefined;
    },
  } as ConfigService<Env, true>;

  const feature = overrides.feature === undefined
    ? { status: 'INACTIVE', expiresAt: null }
    : overrides.feature;

  const uow = {
    withPlatform: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tenantFeature: {
          findUnique: vi.fn(async () => feature),
          upsert: vi.fn(async () => ({ status: 'ACTIVE' })),
        },
      }),
    ),
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        client: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'client-1' })),
        },
        payment: {
          findFirst: vi.fn(async () => overrides.payment ?? null),
        },
      }),
    ),
  } as unknown as UnitOfWork;

  const payments: PaymentsService = {
    requestPayment: vi.fn(async () => ({ paymentId: 'pay-1', status: 'PENDING', redirectUrl: 'https://pay.test/redirect' })),
  } as unknown as PaymentsService;

  return { service: new WhatsappUpgradeService(config, uow, payments), uow, payments };
}

describe('WhatsappUpgradeService', () => {
  it('status returns disabled when no feature row exists', async () => {
    const { service } = makeService({ feature: null });
    await expect(service.status(TENANT)).resolves.toEqual({ enabled: false, priceCents: 50000, currency: 'PKR' });
  });

  it('status returns enabled for an ACTIVE feature', async () => {
    const { service } = makeService({ feature: { status: 'ACTIVE' } });
    await expect(service.status(TENANT)).resolves.toEqual({ enabled: true, priceCents: 50000, currency: 'PKR' });
  });

  it('status returns disabled for an EXPIRED feature', async () => {
    const { service } = makeService({ feature: { status: 'ACTIVE', expiresAt: new Date(Date.now() - 86400_000) } });
    await expect(service.status(TENANT)).resolves.toEqual({ enabled: false, priceCents: 50000, currency: 'PKR' });
  });

  it('enable upserts an ACTIVE feature row', async () => {
    const { service, uow } = makeService();
    await service.enable(TENANT);
    expect(uow.withPlatform).toHaveBeenCalled();
  });

  it('initiate creates a payment for the unlock fee', async () => {
    const { service, payments } = makeService();
    const result = await service.initiate(TENANT, USER, 'https://wakeel.test/return');
    expect(payments.requestPayment).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        amountCents: 50000,
        currency: 'PKR',
        description: 'Official WhatsApp Business API upgrade',
        returnUrl: 'https://wakeel.test/return',
      }),
    );
    expect(result).toMatchObject({ paymentId: 'pay-1', redirectUrl: 'https://pay.test/redirect' });
  });

  it('initiate refuses when already enabled', async () => {
    const { service } = makeService({ feature: { status: 'ACTIVE' } });
    await expect(service.initiate(TENANT, USER, 'https://wakeel.test/return')).rejects.toMatchObject({ status: 409 });
  });

  it('complete enables the feature after a succeeded payment', async () => {
    const { service } = makeService({
      feature: { status: 'INACTIVE' },
      payment: { id: 'pay-1', status: 'SUCCEEDED', description: 'Official WhatsApp Business API upgrade' },
    });
    await expect(service.complete(TENANT, 'pay-1')).resolves.toEqual({ enabled: true });
  });

  it('complete refuses when payment has not succeeded', async () => {
    const { service } = makeService({
      payment: { id: 'pay-1', status: 'PENDING', description: 'Official WhatsApp Business API upgrade' },
    });
    await expect(service.complete(TENANT, 'pay-1')).rejects.toMatchObject({ status: 409 });
  });

  it('complete 404s when payment is missing', async () => {
    const { service } = makeService({ payment: null });
    await expect(service.complete(TENANT, 'pay-1')).rejects.toMatchObject({ status: 404 });
  });
});
