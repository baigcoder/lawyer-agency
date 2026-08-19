import { describe, expect, it, vi } from 'vitest';
import { PaymentDetailsService } from './payment-details.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

const MASTER_KEY = 'a'.repeat(64);

describe('PaymentDetailsService', () => {
  it('round-trips encrypted payment details', async () => {
    let storedEnc: string | null = null;
    const tx = {
      firmPaymentDetails: {
        findUnique: vi.fn(async () => (storedEnc ? { detailsEnc: storedEnc } : null)),
        upsert: vi.fn(async ({ create, update }: { create: { detailsEnc: string }; update: { detailsEnc: string } }) => {
          storedEnc = update?.detailsEnc ?? create.detailsEnc;
          return {};
        }),
      },
    };
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (inner: unknown) => Promise<unknown>) => fn(tx)),
    } as unknown as UnitOfWork;
    const crypto = new CryptoService({ get: (k: string) => (k === 'MASTER_ENCRYPTION_KEY' ? MASTER_KEY : undefined) } as never);
    const service = new PaymentDetailsService(uow, crypto);

    const input = {
      jazzcashNumber: '03001234567',
      easypaisaNumber: '03007654321',
      bankName: 'HBL',
      accountTitle: 'Wakeel Law',
      accountNumber: '1234567890',
      iban: 'PK00HABB1234567890',
    };

    const saved = await service.update('t1', input);
    expect(saved.jazzcashNumber).toBe('03001234567');

    const loaded = await service.get('t1');
    expect(loaded).toEqual(input);
  });
});
