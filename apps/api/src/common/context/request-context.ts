import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
}

/**
 * Request-scoped context propagated through the process without parameter
 * drilling (ADR-005). Entered exactly once — in CorrelationMiddleware — so
 * context can't leak between requests; tenantId is attached later by the
 * auth guard (Phase 10) or webhook tenant resolution (Phase 6).
 */
export class RequestContextStore {
  private static readonly als = new AsyncLocalStorage<RequestContext>();

  static run<T>(context: RequestContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  static get(): RequestContext | undefined {
    return this.als.getStore();
  }

  static set(patch: Partial<RequestContext>): void {
    const store = this.als.getStore();
    if (store) Object.assign(store, patch);
  }

  static correlationId(): string | undefined {
    return this.als.getStore()?.correlationId;
  }

  static tenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  static userId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  /**
   * Hard gate used by the persistence layer: refusing to run tenant-scoped
   * queries without a tenant context is the app-layer complement to RLS
   * (defense-in-depth; the database remains the enforcement, ADR-002).
   */
  static requireTenantId(): string {
    const tenantId = this.tenantId();
    if (!tenantId) {
      throw new Error('Tenant context missing — refusing tenant-scoped data access');
    }
    return tenantId;
  }
}
