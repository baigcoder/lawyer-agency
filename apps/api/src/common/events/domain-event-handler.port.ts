/**
 * Port for a single domain-event consumer (ADR-003). Multiple handlers can
 * register on the shared `domain-events` BullMQ queue; the dispatcher routes
 * by event type so that only one processor is needed per process.
 */

export interface DomainEventJob<T = unknown> {
  tenantId: string;
  type: string;
  payload: T;
  /** Event occurrence time propagated from the outbox row. */
  occurredAt: Date;
}

export interface DomainEventHandler {
  readonly eventType: string;
  handle(job: DomainEventJob): Promise<void>;
}

export const DOMAIN_EVENT_HANDLERS = Symbol('DOMAIN_EVENT_HANDLERS');
