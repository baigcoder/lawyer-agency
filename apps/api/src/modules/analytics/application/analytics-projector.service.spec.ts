import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../../generated/prisma/client';
import { AnalyticsProjector } from './analytics-projector.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

function mockUow() {
  const rawQueries: string[] = [];
  const tx = {
    $executeRawUnsafe: vi.fn(async (query: string, ...params: unknown[]) => {
      rawQueries.push(query);
      void params;
    }),
  } as unknown as Prisma.TransactionClient;

  return {
    uow: {
      withPlatform: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
      withTenant: vi.fn(async <T>(_tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
    } as unknown as UnitOfWork,
    tx,
    rawQueries,
  };
}

describe('AnalyticsProjector', () => {
  it('increments new conversations', async () => {
    const { uow, rawQueries } = mockUow();
    const projector = new AnalyticsProjector(uow);
    await projector.recordNewConversation('t1', 'c1', new Date('2026-08-01T10:00:00Z'));
    expect(rawQueries).toHaveLength(1);
    expect(rawQueries[0]).toContain('"newConversations"');
  });

  it('increments escalations', async () => {
    const { uow, rawQueries } = mockUow();
    const projector = new AnalyticsProjector(uow);
    await projector.recordEscalation('t1', 'e1', new Date('2026-08-01T10:00:00Z'));
    expect(rawQueries[0]).toContain('"escalations"');
  });

  it('increments payments cents', async () => {
    const { uow, rawQueries } = mockUow();
    const projector = new AnalyticsProjector(uow);
    await projector.recordPayment('t1', 50000, new Date('2026-08-01T10:00:00Z'));
    expect(rawQueries[0]).toContain('"paymentsCents"');
  });
});
