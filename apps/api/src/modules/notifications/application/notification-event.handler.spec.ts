import { describe, expect, it, vi } from 'vitest';
import { createNotificationHandlers } from './notification-event.handler';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventJob } from '../../../common/events/domain-event-handler.port';

function makeHandlers() {
  const dispatched: Array<{ tenantId: string; userId: string; type: string }> = [];
  const dispatcher = {
    dispatch: vi.fn(async (input: { tenantId: string; userId: string; type: string }) => {
      dispatched.push(input);
    }),
  };
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user: { findMany: vi.fn(async () => [{ id: 'u1' }, { id: 'u2' }]) } }),
    ),
  } as never;
  const handlers = createNotificationHandlers(dispatcher as never, uow as never);
  return { handlers, dispatched };
}

describe('createNotificationHandlers', () => {
  it('notifies users on escalation triggered', async () => {
    const { handlers, dispatched } = makeHandlers();
    const handler = handlers.find((h) => h.eventType === DOMAIN_EVENTS.AiEscalationTriggered);
    expect(handler).toBeDefined();
    await handler!.handle({
      tenantId: 't1',
      type: DOMAIN_EVENTS.AiEscalationTriggered,
      payload: { conversationId: 'c1', escalationId: 'e1', triggerType: 'DOMESTIC_VIOLENCE' },
    } as DomainEventJob);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toMatchObject({ tenantId: 't1', type: 'escalation.opened' });
  });

  it('notifies users on case created', async () => {
    const { handlers, dispatched } = makeHandlers();
    const handler = handlers.find((h) => h.eventType === DOMAIN_EVENTS.CaseCreated);
    await handler!.handle({
      tenantId: 't1',
      type: DOMAIN_EVENTS.CaseCreated,
      payload: { caseId: 'c1', clientId: 'cl1', reference: 'FAM-1', matterType: 'Family' },
    } as DomainEventJob);
    expect(dispatched[0]).toMatchObject({ tenantId: 't1', type: 'case.created' });
  });

  it('emails and dashboards a payment receipt with client and work', async () => {
    const dispatched: Array<{ type: string; body: string; forceChannels?: string[] }> = [];
    const dispatcher = {
      dispatch: vi.fn(async (input: { type: string; body: string; forceChannels?: string[] }) => {
        dispatched.push(input);
      }),
    };
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          user: { findMany: vi.fn(async () => [{ id: 'owner-1' }]) },
          payment: {
            findFirst: vi.fn(async () => ({
              amountCents: 500000,
              description: 'Completed meeting / work',
              client: { name: 'Ayesha Khan', waPhone: '923001234567' },
              case: { reference: 'FAM-22', matterType: 'Family' },
            })),
          },
        }),
      ),
    } as never;
    const handlers = createNotificationHandlers(dispatcher as never, uow as never);
    const handler = handlers.find((h) => h.eventType === DOMAIN_EVENTS.PaymentSucceeded);
    await handler!.handle({
      tenantId: 't1',
      type: DOMAIN_EVENTS.PaymentSucceeded,
      payload: {
        paymentId: 'pay-1',
        paidAt: '2026-08-19T08:00:00.000Z',
        amountCents: 500000,
        clientId: 'cl1',
      },
    } as DomainEventJob);
    expect(dispatched[0]).toMatchObject({
      type: 'payment.succeeded',
      forceChannels: ['DASHBOARD', 'EMAIL_DIGEST'],
    });
    expect(dispatched[0]?.body).toContain('Ayesha Khan');
    expect(dispatched[0]?.body).toContain('Completed meeting / work');
  });

  it('notifies staff when a payment screenshot arrives', async () => {
    const dispatched: Array<{ type: string; url?: string }> = [];
    const dispatcher = {
      dispatch: vi.fn(async (input: { type: string; url?: string }) => {
        dispatched.push(input);
      }),
    };
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          user: { findMany: vi.fn(async () => [{ id: 'owner-1' }]) },
          payment: {
            findFirst: vi.fn(async () => ({
              amountCents: 300000,
              client: { name: 'Ayesha Khan', waPhone: '923001234567' },
            })),
          },
        }),
      ),
    } as never;
    const handlers = createNotificationHandlers(dispatcher as never, uow as never);
    const handler = handlers.find((h) => h.eventType === DOMAIN_EVENTS.PaymentProofReceived);
    await handler!.handle({
      tenantId: 't1',
      type: DOMAIN_EVENTS.PaymentProofReceived,
      payload: {
        paymentId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d01',
        clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d02',
        documentId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d03',
        messageId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d04',
        conversationId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d05',
      },
    } as DomainEventJob);
    expect(dispatched[0]).toMatchObject({
      type: 'payment.proof_received',
      url: '/dashboard/inbox?conversation=018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d05',
    });
  });
});
