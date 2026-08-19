import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../../generated/prisma/client';
import { AnalyticsService } from './analytics.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function mockOperationalUow(data: {
  conversations?: Date[];
  aiMessages?: Date[];
  humanMessages?: Date[];
  escalations?: Date[];
  acks?: Array<{ createdAt: Date; acknowledgedAt: Date }>;
  casesOpened?: Date[];
  casesClosed?: Date[];
  payments?: Array<{ paidAt: Date; amountCents: number }>;
}) {
  const inWindow = (date: Date, gte?: Date, lt?: Date) => {
    if (gte && date.getTime() < gte.getTime()) return false;
    if (lt && date.getTime() >= lt.getTime()) return false;
    return true;
  };

  const tx = {
    conversation: {
      count: vi.fn(async (args?: { where?: { createdAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.createdAt;
        return (data.conversations ?? []).filter((d) => inWindow(d, w?.gte, w?.lt)).length;
      }),
      findMany: vi.fn(async (args?: { where?: { createdAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.createdAt;
        return (data.conversations ?? [])
          .filter((d) => inWindow(d, w?.gte, w?.lt))
          .map((createdAt) => ({ createdAt }));
      }),
    },
    escalation: {
      count: vi.fn(async (args?: { where?: { createdAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.createdAt;
        return (data.escalations ?? []).filter((d) => inWindow(d, w?.gte, w?.lt)).length;
      }),
      findMany: vi.fn(async (args?: {
        where?: { createdAt?: { gte?: Date; lt?: Date }; acknowledgedAt?: { gte?: Date; lt?: Date } };
      }) => {
        if (args?.where?.acknowledgedAt) {
          const w = args.where.acknowledgedAt;
          return (data.acks ?? []).filter((a) => inWindow(a.acknowledgedAt, w.gte, w.lt));
        }
        const w = args?.where?.createdAt;
        return (data.escalations ?? [])
          .filter((d) => inWindow(d, w?.gte, w?.lt))
          .map((createdAt) => ({ createdAt }));
      }),
    },
    case: {
      count: vi.fn(async (args?: { where?: { openedAt?: { gte?: Date; lt?: Date }; closedAt?: { gte?: Date; lt?: Date } } }) => {
        if (args?.where?.openedAt) {
          const w = args.where.openedAt;
          return (data.casesOpened ?? []).filter((d) => inWindow(d, w.gte, w.lt)).length;
        }
        if (args?.where?.closedAt) {
          const w = args.where.closedAt;
          return (data.casesClosed ?? []).filter((d) => inWindow(d, w.gte, w.lt)).length;
        }
        return 0;
      }),
      findMany: vi.fn(async (args?: { where?: { openedAt?: { gte?: Date; lt?: Date }; closedAt?: { gte?: Date; lt?: Date } } }) => {
        if (args?.where?.openedAt) {
          const w = args.where.openedAt;
          return (data.casesOpened ?? [])
            .filter((d) => inWindow(d, w.gte, w.lt))
            .map((openedAt) => ({ openedAt }));
        }
        if (args?.where?.closedAt) {
          const w = args.where.closedAt;
          return (data.casesClosed ?? [])
            .filter((d) => inWindow(d, w.gte, w.lt))
            .map((closedAt) => ({ closedAt }));
        }
        return [];
      }),
    },
    message: {
      count: vi.fn(async (args?: { where?: { senderType?: string | { in: string[] }; createdAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.createdAt;
        const sender = args?.where?.senderType;
        const pool =
          sender === 'AI'
            ? data.aiMessages ?? []
            : typeof sender === 'object'
              ? data.humanMessages ?? []
              : [];
        return pool.filter((d) => inWindow(d, w?.gte, w?.lt)).length;
      }),
      findMany: vi.fn(async (args?: { where?: { senderType?: string | { in: string[] }; createdAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.createdAt;
        const sender = args?.where?.senderType;
        const pool =
          sender === 'AI'
            ? data.aiMessages ?? []
            : typeof sender === 'object'
              ? data.humanMessages ?? []
              : [];
        return pool.filter((d) => inWindow(d, w?.gte, w?.lt)).map((createdAt) => ({ createdAt }));
      }),
    },
    payment: {
      aggregate: vi.fn(async (args?: { where?: { paidAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.paidAt;
        const total = (data.payments ?? [])
          .filter((p) => inWindow(p.paidAt, w?.gte, w?.lt))
          .reduce((acc, p) => acc + p.amountCents, 0);
        return { _sum: { amountCents: total } };
      }),
      findMany: vi.fn(async (args?: { where?: { paidAt?: { gte?: Date; lt?: Date } } }) => {
        const w = args?.where?.paidAt;
        return (data.payments ?? []).filter((p) => inWindow(p.paidAt, w?.gte, w?.lt));
      }),
    },
  } as unknown as Prisma.TransactionClient;

  return {
    uow: {
      withTenant: vi.fn(async <T>(_tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
    } as unknown as UnitOfWork,
    tx,
  };
}

describe('AnalyticsService', () => {
  it('aggregates last-7 and last-30 windows from operational tables', async () => {
    const { uow } = mockOperationalUow({
      conversations: [daysAgo(1), daysAgo(2), daysAgo(10)],
      aiMessages: [daysAgo(1), daysAgo(1)],
      humanMessages: [daysAgo(3)],
      escalations: [daysAgo(2)],
      acks: [{ createdAt: daysAgo(2), acknowledgedAt: new Date(daysAgo(2).getTime() + 10 * 60 * 1000) }],
      casesOpened: [daysAgo(1), daysAgo(1)],
      casesClosed: [daysAgo(4)],
      payments: [
        { paidAt: daysAgo(1), amountCents: 10000 },
        { paidAt: daysAgo(20), amountCents: 5000 },
      ],
    });
    const service = new AnalyticsService(uow);

    const metrics = await service.dashboard('t1');

    expect(metrics.newLeads7d).toBe(2);
    expect(metrics.aiContainmentRate).toBeCloseTo(2 / 3);
    expect(metrics.escalations7d).toBe(1);
    expect(metrics.casesOpened7d).toBe(2);
    expect(metrics.casesClosed7d).toBe(1);
    expect(metrics.feesCollectedCents30d).toBe(15000);
    expect(metrics.avgEscalationAckMinutes7d).toBe(10);
  });

  it('returns null containment when no outbound replies in window', async () => {
    const { uow } = mockOperationalUow({});
    const service = new AnalyticsService(uow);
    const metrics = await service.dashboard('t1');
    expect(metrics.aiContainmentRate).toBeNull();
    expect(metrics.avgEscalationAckMinutes7d).toBeNull();
  });

  it('zero-fills daily series from operational activity', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const { uow } = mockOperationalUow({
      conversations: [daysAgo(0), daysAgo(0), daysAgo(5)],
      escalations: [daysAgo(0)],
    });
    const service = new AnalyticsService(uow);

    const series = await service.daily('t1', 7);
    const today = series.find((p) => p.date === todayKey);

    expect(series).toHaveLength(7);
    expect(today?.newConversations).toBe(2);
    expect(today?.escalations).toBe(1);
    expect(series.some((p) => p.newConversations === 0)).toBe(true);
  });
});
