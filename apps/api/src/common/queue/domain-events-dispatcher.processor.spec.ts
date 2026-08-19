import { describe, expect, it, vi } from 'vitest';
import { DomainEventsDispatcher } from './domain-events-dispatcher.processor';
import type { DomainEventHandler, DomainEventJob } from '../events/domain-event-handler.port';

describe('DomainEventsDispatcher', () => {
  it('routes events to matching handlers', async () => {
    const handlerA: DomainEventHandler = { eventType: 'a', handle: vi.fn(async () => {}) };
    const handlerB: DomainEventHandler = { eventType: 'b', handle: vi.fn(async () => {}) };
    const dispatcher = new DomainEventsDispatcher([handlerA, handlerB]);

    const job = { name: 'a', data: { tenantId: 't1', type: 'a', payload: { x: 1 } } } as never;
    await dispatcher.process(job);

    expect(handlerA.handle).toHaveBeenCalledWith(job.data);
    expect(handlerB.handle).not.toHaveBeenCalled();
  });

  it('calls multiple handlers for the same event type', async () => {
    const handlerA: DomainEventHandler = { eventType: 'a', handle: vi.fn(async () => {}) };
    const handlerA2: DomainEventHandler = { eventType: 'a', handle: vi.fn(async () => {}) };
    const dispatcher = new DomainEventsDispatcher([handlerA, handlerA2]);

    const job = { name: 'a', data: { tenantId: 't1', type: 'a', payload: {} } } as DomainEventJob as never;
    await dispatcher.process(job as never);

    expect(handlerA.handle).toHaveBeenCalled();
    expect(handlerA2.handle).toHaveBeenCalled();
  });
});
