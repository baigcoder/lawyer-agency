import { describe, expect, it, vi } from 'vitest';
import { LawyersService } from './lawyers.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';

function makeService() {
  const lawyers: Record<string, unknown>[] = [];
  const availability: Record<string, unknown>[] = [];
  const users = new Map<string, { id: string; name: string; email: string }>([
    ['u1', { id: 'u1', name: 'Barrister A', email: 'a@firm.pk' }],
  ]);

  const tx = {
    user: { findFirst: vi.fn(async (a: { where: { id: string } }) => users.get(a.where.id) ?? null) },
    lawyer: {
      findMany: vi.fn(async () =>
        lawyers.map((l) => ({
          ...l,
          user: users.get(l.userId as string),
          availability: availability.filter((av) => av.lawyerId === l.id),
        })),
      ),
      findFirst: vi.fn(async (a: { where: { id: string } }) => {
        const l = lawyers.find((x) => x.id === a.where.id);
        return l ? { ...l, user: users.get(l.userId as string), availability: availability.filter((av) => av.lawyerId === l.id) } : null;
      }),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const l = { id: `l-${lawyers.length + 1}`, ...a.data };
        lawyers.push(l);
        return { ...l, user: users.get(l.userId as string) };
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const i = lawyers.findIndex((x) => x.id === a.where.id);
        if (i >= 0) lawyers[i] = { ...lawyers[i], ...a.data };
        return { ...lawyers[i], user: users.get(lawyers[i].userId as string) };
      }),
    },
    lawyerAvailability: {
      deleteMany: vi.fn(async () => ({ count: availability.length })),
      createMany: vi.fn(async (a: { data: Record<string, unknown>[] }) => {
        for (const d of a.data) availability.push(d);
        return { count: a.data.length };
      }),
    },
    outboxEvent: { create: vi.fn(async () => ({})) },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const outbox = { append: vi.fn(async () => undefined) } as unknown as OutboxWriter;
  return { service: new LawyersService(uow, outbox), tx, lawyers, outbox };
}

describe('LawyersService', () => {
  it('creates a lawyer profile from an existing user', async () => {
    const { service, outbox } = makeService();
    const l = await service.create('t1', { userId: 'u1', practiceAreas: ['Family'] });
    expect(l.userId).toBe('u1');
    expect(l.practiceAreas).toEqual(['Family']);
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'lawyer.created', expect.objectContaining({ userId: 'u1' }));
  });

  it('throws when the user does not exist', async () => {
    const { service } = makeService();
    await expect(service.create('t1', { userId: 'missing', practiceAreas: [] })).rejects.toThrow();
  });

  it('replaces availability and appends event', async () => {
    const { service, outbox } = makeService();
    const l = await service.create('t1', { userId: 'u1', practiceAreas: ['Criminal'] });
    const slots = await service.setAvailability('t1', l.id, {
      slots: [{ weekday: 1, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 }],
    });
    expect(slots).toHaveLength(1);
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'lawyer.availability.updated', expect.objectContaining({ lawyerId: l.id }));
  });

  it('lists lawyers with user names', async () => {
    const { service } = makeService();
    await service.create('t1', { userId: 'u1', practiceAreas: [] });
    const list = await service.list('t1');
    expect(list[0].name).toBe('Barrister A');
  });
});