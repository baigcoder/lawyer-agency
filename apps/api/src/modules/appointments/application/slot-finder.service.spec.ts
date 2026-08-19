import { describe, expect, it, vi } from 'vitest';
import { SlotFinderService } from './slot-finder.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { pktDateTime } from './slot-math';

describe('SlotFinderService', () => {
  it('resolves a lawyer and returns open slots', async () => {
    const now = pktDateTime('2026-08-19', '08:00');
    const tx = {
      lawyer: {
        findFirst: vi.fn(async () => ({ id: 'lw1', user: { name: 'Adv. Ali' } })),
      },
      caseLawyer: { findFirst: vi.fn(async () => null) },
      lawyerAvailability: {
        findMany: vi.fn(async () => [
          { weekday: 3, startTime: '15:00', endTime: '16:00', slotDurationMinutes: 30 },
        ]),
      },
      appointment: { findMany: vi.fn(async () => []) },
    };
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (inner: unknown) => Promise<unknown>) => fn(tx)),
    } as unknown as UnitOfWork;

    const service = new SlotFinderService(uow);
    const offer = await service.listOpenSlots('t1', { now, limit: 3 });
    expect(offer?.lawyerName).toBe('Adv. Ali');
    expect(offer?.slots[0]?.startsAt.toISOString()).toBe(pktDateTime('2026-08-19', '15:00').toISOString());
  });
});
