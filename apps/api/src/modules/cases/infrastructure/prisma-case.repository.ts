import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { DbTx } from '../../../common/persistence/db-tx';
import { toInputJson } from '../../../common/persistence/json';
import {
  CaseNotFoundError,
  DuplicateReferenceError,
  type CaseEntity,
  type CaseStatus,
  type NewCase,
} from '../domain/case';
import type { CaseRepository } from '../application/ports';

type CaseRow = Prisma.CaseGetPayload<object>;

function toRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // JsonObject is Record<string, JsonValue>, assignable without a cast.
    return value;
  }
  return {};
}

function toEntity(row: CaseRow): CaseEntity {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    reference: row.reference,
    matterType: row.matterType,
    status: row.status,
    urgency: row.urgency,
    summary: row.summary,
    intakeData: toRecord(row.intakeData),
    openedAt: row.openedAt,
    closedAt: row.closedAt,
  };
}

/**
 * Prisma adapter for the Cases port. Tenant isolation is enforced by RLS
 * (the transaction carries the GUC); ORM errors are translated into domain
 * errors here so the application layer never sees vendor exceptions.
 */
@Injectable()
export class PrismaCaseRepository implements CaseRepository {
  async create(tx: DbTx, data: NewCase): Promise<CaseEntity> {
    try {
      const row = await tx.case.create({
        data: {
          tenantId: data.tenantId,
          clientId: data.clientId,
          reference: data.reference,
          matterType: data.matterType,
          urgency: data.urgency,
          summary: data.summary,
          intakeData: toInputJson(data.intakeData),
        },
      });
      return toEntity(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateReferenceError(data.reference);
      }
      throw error;
    }
  }

  async findById(tx: DbTx, id: string): Promise<CaseEntity | null> {
    const row = await tx.case.findFirst({ where: { id } });
    return row === null ? null : toEntity(row);
  }

  async updateStatus(
    tx: DbTx,
    id: string,
    status: CaseStatus,
    closedAt: Date | null,
  ): Promise<CaseEntity> {
    try {
      const row = await tx.case.update({ where: { id }, data: { status, closedAt } });
      return toEntity(row);
    } catch (error) {
      // RLS makes cross-tenant rows invisible → update hits 0 rows → P2025.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new CaseNotFoundError(id);
      }
      throw error;
    }
  }

  async assignLawyer(
    tx: DbTx,
    tenantId: string,
    caseId: string,
    lawyerId: string,
    role: string,
  ): Promise<void> {
    try {
      await tx.caseLawyer.create({ data: { tenantId, caseId, lawyerId, role } });
    } catch (error) {
      // Same lawyer, same role, twice → idempotent success (D-015 discipline).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  async listOpen(tx: DbTx): Promise<CaseEntity[]> {
    const rows = await tx.case.findMany({
      where: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map(toEntity);
  }

  async listAll(tx: DbTx): Promise<CaseEntity[]> {
    const rows = await tx.case.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return rows.map(toEntity);
  }
}
