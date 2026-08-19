import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type { DbTx } from '../../../common/persistence/db-tx';
import type { PilotAllowlistEntry, PilotSessionRecord, PilotSessionRepository } from '../application/ports';

/**
 * Reads the allowlist defensively (A9): rows written before labeled entries
 * may still hold a plain string array — map those to { number, label: null }
 * instead of crashing the pilot surface.
 */
function readAllowlist(raw: unknown): PilotAllowlistEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === 'string') return [{ number: entry, label: null }];
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as PilotAllowlistEntry).number === 'string'
    ) {
      const e = entry as PilotAllowlistEntry;
      return [{ number: e.number, label: typeof e.label === 'string' ? e.label : null }];
    }
    return [];
  });
}

@Injectable()
export class PrismaPilotSessionRepository implements PilotSessionRepository {
  async findByTenant(tx: DbTx, tenantId: string): Promise<PilotSessionRecord | null> {
    const row = await tx.pilotSession.findUnique({ where: { tenantId } });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      status: row.status as PilotSessionRecord['status'],
      allowlist: readAllowlist(row.allowlist),
      sessionCredsEnc: row.sessionCredsEnc,
      expiresAt: row.expiresAt,
      lastSeenAt: row.lastSeenAt,
      lastError: row.lastError,
      lastErrorAt: row.lastErrorAt,
    };
  }

  async upsert(
    tx: DbTx,
    tenantId: string,
    data: Partial<Omit<PilotSessionRecord, 'tenantId'>>,
  ): Promise<void> {
    await tx.pilotSession.upsert({
      where: { tenantId },
      create: {
        tenantId,
        status: (data.status ?? 'PAIRING') as never,
        allowlist: (data.allowlist ?? []) as unknown as Prisma.InputJsonValue,
        sessionCredsEnc: data.sessionCredsEnc ?? null,
        expiresAt: data.expiresAt ?? new Date(),
        lastSeenAt: data.lastSeenAt ?? null,
        lastError: data.lastError ?? null,
        lastErrorAt: data.lastErrorAt ?? null,
      },
      update: {
        ...(data.status !== undefined ? { status: data.status as never } : {}),
        ...(data.allowlist !== undefined
          ? { allowlist: data.allowlist as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.sessionCredsEnc !== undefined ? { sessionCredsEnc: data.sessionCredsEnc } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
        ...(data.lastSeenAt !== undefined ? { lastSeenAt: data.lastSeenAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
        ...(data.lastErrorAt !== undefined ? { lastErrorAt: data.lastErrorAt } : {}),
      },
    });
  }
}
