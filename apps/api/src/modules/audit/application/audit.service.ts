import { Injectable } from '@nestjs/common';
import type { ActorType } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

/**
 * Append-only audit log writer (FR-AUD-01/03). Every privileged action and
 * break-glass access is recorded. The migration role revoked UPDATE/DELETE
 * on `audit_logs` from `app_user`, so the database enforces immutability —
 * this service can only INSERT.
 */
@Injectable()
export class AuditService {
  constructor(private readonly uow: UnitOfWork) {}

  async record(tenantId: string, entry: AuditEntry): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: toInputJson(entry.metadata ?? {}),
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          correlationId: entry.correlationId ?? null,
        },
      });
    });
  }

  async list(
    tenantId: string,
    opts: { action?: string; limit?: number; offset?: number } = {},
  ): Promise<Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date;
  }>> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: opts.action ? { action: { contains: opts.action } } : {},
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      });
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        actorType: r.actorType,
        actorId: r.actorId,
        entityType: r.entityType,
        entityId: r.entityId,
        createdAt: r.createdAt,
      }));
    });
  }
}