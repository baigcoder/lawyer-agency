import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../common/persistence/db-tx';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type {
  ConnectionStage,
  WaRoute,
  WaRouteLookup,
  WhatsappAccountRecord,
  WhatsappAccountRepository,
  WhatsappTemplateRepository,
  UpsertTemplateInput,
} from '../application/ports';

/**
 * platform.wa_routes is infrastructure (D-040): the ONLY table webhook
 * ingress reads before a tenant context exists. withPlatform is confined to
 * exactly this kind of path (ADR-002).
 */
@Injectable()
export class PrismaWaRouteLookup implements WaRouteLookup {
  constructor(private readonly uow: UnitOfWork) {}

  async findByPhoneNumberId(phoneNumberId: string): Promise<WaRoute | null> {
    return this.uow.withPlatform(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ tenantId: string; wabaId: string }>>`
        SELECT "tenantId", "wabaId" FROM platform.wa_routes WHERE "phoneNumberId" = ${phoneNumberId}`;
      return rows[0] ?? null;
    });
  }
}

@Injectable()
export class PrismaWhatsappAccountRepository implements WhatsappAccountRepository {
  async findByTenant(tx: DbTx, tenantId: string): Promise<WhatsappAccountRecord | null> {
    const row = await tx.whatsappAccount.findFirst({ where: { tenantId } });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      accessTokenEnc: row.accessTokenEnc,
      connectionStage: row.connectionStage,
    };
  }

  async updateConnectionStage(
    tx: DbTx,
    tenantId: string,
    stage: ConnectionStage,
    patch?: { verificationStatus?: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; clearToken?: boolean },
  ): Promise<void> {
    await tx.whatsappAccount.updateMany({
      where: { tenantId },
      data: {
        connectionStage: stage,
        ...(patch?.verificationStatus ? { verificationStatus: patch.verificationStatus } : {}),
        ...(patch?.clearToken ? { accessTokenEnc: null } : {}),
      },
    });
  }
}

@Injectable()
export class PrismaWhatsappTemplateRepository implements WhatsappTemplateRepository {
  async findByNameAndLanguage(tx: DbTx, tenantId: string, name: string, language: string) {
    return tx.whatsappTemplate.findFirst({
      where: { tenantId, name, language },
      select: { id: true, status: true },
    });
  }

  async countApproved(tx: DbTx, tenantId: string): Promise<number> {
    return tx.whatsappTemplate.count({ where: { tenantId, status: 'APPROVED' } });
  }

  async upsert(tx: DbTx, tenantId: string, input: UpsertTemplateInput): Promise<void> {
    const status = mapTemplateStatus(input.status);
    await tx.whatsappTemplate.upsert({
      where: { tenantId_name_language: { tenantId, name: input.name, language: input.language } },
      create: {
        tenantId,
        name: input.name,
        language: input.language,
        category: mapTemplateCategory(input.category),
        status,
        components: input.components as never,
        metaTemplateId: input.metaTemplateId ?? null,
        rejectionReason: input.rejectionReason ?? null,
      },
      update: {
        status,
        components: input.components as never,
        metaTemplateId: input.metaTemplateId ?? null,
        rejectionReason: input.rejectionReason ?? null,
      },
    });
  }

  async updateStatusByMetaId(
    tx: DbTx,
    tenantId: string,
    metaTemplateId: string,
    status: string,
    rejectionReason?: string | null,
  ): Promise<boolean> {
    const existing = await tx.whatsappTemplate.findFirst({ where: { tenantId, metaTemplateId } });
    if (!existing) return false;
    await tx.whatsappTemplate.update({
      where: { id: existing.id },
      data: { status: mapTemplateStatus(status), rejectionReason: rejectionReason ?? null },
    });
    return true;
  }
}

function mapTemplateCategory(category: string): 'UTILITY' | 'AUTHENTICATION' | 'SERVICE' {
  const upper = category.toUpperCase();
  if (upper === 'AUTHENTICATION') return 'AUTHENTICATION';
  if (upper === 'SERVICE') return 'SERVICE';
  return 'UTILITY';
}

function mapTemplateStatus(status: string): 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAUSED' {
  const upper = status.toUpperCase();
  switch (upper) {
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'PENDING':
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'PAUSED':
      return 'PAUSED';
    default:
      return 'DRAFT';
  }
}
