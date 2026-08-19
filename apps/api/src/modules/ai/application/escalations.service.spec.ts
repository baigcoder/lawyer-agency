import { describe, expect, it, vi } from 'vitest';
import { EscalationsService } from './escalations.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

function makeService() {
  const escalations: Record<string, unknown>[] = [
    {
      id: 'esc-1',
      tenantId: 't1',
      conversationId: 'conv-1',
      triggerType: 'DOMESTIC_VIOLENCE',
      status: 'OPEN',
      detectedExcerpt: 'he hit me',
      handoffReason: 'abuse',
      handoffBrief: { reason: 'abuse', matterType: 'Family Law', facts: {}, documents: { requests: [], files: [] }, openItems: [], nextAction: 'Call now' },
      slaDeadline: new Date(Date.now() + 60_000),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      acknowledgedBy: null,
    },
  ];

  const tx = {
    escalation: {
      findMany: vi.fn(async () =>
        escalations.map((e) => ({
          ...e,
          conversation: {
            client: { id: 'client-1', name: 'Ayesha', waPhone: '923001234567' },
            assignedTo: { id: 'user-1', name: 'Sara Khan' },
          },
          acknowledger: null,
        })),
      ),
      findFirst: vi.fn(async (args: { where: { id?: string } }) => {
        const row = escalations.find((e) => e.id === args.where.id);
        if (!row) return null;
        return {
          ...row,
          conversation: {
            client: { id: 'client-1', name: 'Ayesha', waPhone: '923001234567' },
            assignedTo: { id: 'user-1', name: 'Sara Khan' },
          },
          acknowledger: null,
        };
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = escalations.findIndex((e) => e.id === args.where.id);
        if (idx === -1) throw new Error('not found');
        escalations[idx] = { ...escalations[idx], ...args.data };
        return {
          ...escalations[idx],
          conversation: {
            client: { id: 'client-1', name: 'Ayesha', waPhone: '923001234567' },
            assignedTo: { id: 'user-1', name: 'Sara Khan' },
          },
          acknowledger: null,
        };
      }),
    },
    lawyer: {
      findFirst: vi.fn(async () => ({ id: 'lawyer-1' })),
    },
  };

  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;

  return { service: new EscalationsService(uow), tx, escalations };
}

describe('EscalationsService', () => {
  it('lists escalations with client and SLA breach flag', async () => {
    const { service } = makeService();
    const rows = await service.list('t1', {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.client.name).toBe('Ayesha');
    expect(rows[0]?.handoffReason).toBe('abuse');
    expect(rows[0]?.handoffBrief.nextAction).toBe('Call now');
    expect(rows[0]?.slaBreached).toBe(false);
  });

  it('acknowledges an open escalation', async () => {
    const { service, tx } = makeService();
    const updated = await service.acknowledge('t1', 'esc-1', 'user-1');
    expect(updated.status).toBe('ACKNOWLEDGED');
    expect(tx.escalation.update).toHaveBeenCalled();
  });

  it('resolves an escalation', async () => {
    const { service } = makeService();
    const updated = await service.resolve('t1', 'esc-1');
    expect(updated.status).toBe('RESOLVED');
  });
});
