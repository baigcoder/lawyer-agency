import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

function makeService() {
  const logs: Record<string, unknown>[] = [];
  const tx = {
    auditLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: `al-${logs.length + 1}`, createdAt: new Date(), ...args.data };
        logs.push(row);
        return row;
      }),
      findMany: vi.fn(async (args: { take?: number; skip?: number; where?: { action?: { contains: string } } }) => {
        let result = logs;
        if (args.where?.action) {
          result = logs.filter((l) => String(l.action).includes(args.where!.action!.contains));
        }
        return result.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? 50));
      }),
    },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  return { service: new AuditService(uow), tx, logs };
}

describe('AuditService', () => {
  it('records an audit entry', async () => {
    const { service, tx, logs } = makeService();
    await service.record('t1', {
      actorType: 'USER',
      actorId: 'u1',
      action: 'payment.refund',
      entityType: 'payment',
      entityId: 'p1',
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(logs[0]).toMatchObject({ action: 'payment.refund', actorType: 'USER' });
  });

  it('lists audit entries filtered by action', async () => {
    const { service } = makeService();
    await service.record('t1', { actorType: 'USER', action: 'cases.create' });
    await service.record('t1', { actorType: 'USER', action: 'payment.refund' });
    const refunds = await service.list('t1', { action: 'refund' });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].action).toBe('payment.refund');
  });

  it('appends metadata and correlation id', async () => {
    const { service, logs } = makeService();
    await service.record('t1', {
      actorType: 'SYSTEM',
      action: 'system.test',
      metadata: { foo: 'bar' },
      correlationId: '00000000-0000-0000-0000-000000000000',
    });
    expect(logs[0]).toMatchObject({ metadata: { foo: 'bar' }, correlationId: '00000000-0000-0000-0000-000000000000' });
  });
});