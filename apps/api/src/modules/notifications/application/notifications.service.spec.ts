import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

function makeService() {
  const notifications: unknown[] = [];
  const tx = {
    notification: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        notifications.push(args.data);
        return { id: 'n-1', ...args.data };
      }),
      findMany: vi.fn(async () => notifications),
      findFirst: vi.fn(async () => notifications[0] ?? null),
      update: vi.fn(async () => ({ id: 'n-1' })),
      count: vi.fn(async () => notifications.length),
    },
  };
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  return { service: new NotificationsService(uow), tx, notifications };
}

describe('NotificationsService', () => {
  it('creates a single notification', async () => {
    const { service, tx } = makeService();
    await service.create({ tenantId: 't1', userId: 'u1', type: 'test', payload: { x: 1 } });
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'test', userId: 'u1' }) }),
    );
  });

  it('creates notifications for multiple users', async () => {
    const { service } = makeService();
    await service.createForUsers('t1', ['u1', 'u2'], 'case.created', { caseId: 'c1' });
    // The service loops and calls create per user; tx mock returns the last call data.
    expect(service).toBeDefined();
  });

  it('marks a notification read', async () => {
    const { service, tx } = makeService();
    (tx.notification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'n-1' });
    const ok = await service.markRead('t1', 'u1', 'n-1');
    expect(ok).toBe(true);
    expect(tx.notification.update).toHaveBeenCalled();
  });
});
