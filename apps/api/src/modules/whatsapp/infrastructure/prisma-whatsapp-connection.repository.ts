import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../common/persistence/db-tx';
import type {
  EvolutionConnectionStatus,
  EvolutionConnectionType,
  WhatsappConnectionRecord,
  WhatsappConnectionRepository,
} from '../application/ports';

@Injectable()
export class PrismaWhatsappConnectionRepository implements WhatsappConnectionRepository {
  async findByTenant(tx: DbTx, tenantId: string): Promise<WhatsappConnectionRecord | null> {
    const row = await tx.whatsappConnection.findUnique({ where: { tenantId } });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      instanceName: row.instanceName,
      connectionType: row.connectionType as EvolutionConnectionType,
      status: row.status as EvolutionConnectionStatus,
      phoneNumber: row.phoneNumber,
      displayName: row.displayName,
    };
  }

  async upsert(
    tx: DbTx,
    tenantId: string,
    data: Partial<Omit<WhatsappConnectionRecord, 'tenantId'>>,
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.instanceName !== undefined) payload.instanceName = data.instanceName;
    if (data.connectionType !== undefined) payload.connectionType = data.connectionType;
    if (data.status !== undefined) payload.status = data.status;
    if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber;
    if (data.displayName !== undefined) payload.displayName = data.displayName;

    await tx.whatsappConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        instanceName: data.instanceName ?? `wakeel-${tenantId}`,
        connectionType: data.connectionType ?? 'baileys',
        status: data.status ?? 'disconnected',
        phoneNumber: data.phoneNumber ?? null,
        displayName: data.displayName ?? null,
      },
      update: payload,
    });
  }

  async remove(tx: DbTx, tenantId: string): Promise<void> {
    await tx.whatsappConnection.deleteMany({ where: { tenantId } });
  }
}
