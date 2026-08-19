import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

/**
 * The persistence boundary (Repository + Unit of Work per the brief's
 * engineering principles). Every tenant-scoped read/write goes through
 * withTenant(), which pins `app.tenant_id` for the duration of the
 * transaction — that GUC is what the RLS policies bind to (ADR-002).
 *
 * set_config(name, value, true) is the parameterizable equivalent of
 * SET LOCAL: transaction-scoped, therefore safe under connection pooling.
 * tenantId travels as a bind parameter — never string-interpolated SQL.
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return fn(tx);
      },
      // Allow longer-running orchestrator transactions (LLM calls inside).
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  /**
   * Cross-tenant infrastructure work only (webhook inbox before tenant
   * resolution, outbox dispatcher). Touches the `platform` schema — using it
   * for tenant data is a design violation (D-019).
   */
  async withPlatform<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.client.$transaction(fn, { maxWait: 10_000, timeout: 60_000 });
  }

  /**
   * Pre-tenant platform work bound to a verified Clerk organization: pins
   * `app.clerk_org_id` for the transaction so the RLS policies on
   * `platform.tenants` (migration 0013) allow exactly the caller's own
   * tenant row to be read (principal resolution) or created (provisioning).
   * Fail-closed: with no GUC, RLS returns zero rows.
   */
  async withOrgContext<T>(
    clerkOrgId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.clerk_org_id', ${clerkOrgId}, true)`;
        return fn(tx);
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
