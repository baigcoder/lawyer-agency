import { Injectable, NotFoundException } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { CreateHearingInput, HearingDto, UpdateHearingInput } from './hearings.dto';

@Injectable()
export class HearingsService {
  constructor(private readonly uow: UnitOfWork) {}

  async listForCase(tenantId: string, caseId: string): Promise<HearingDto[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const caseRow = await tx.case.findFirst({ where: { id: caseId } });
      if (!caseRow) throw new NotFoundException('case not found');

      const rows = await tx.courtHearing.findMany({
        where: { caseId },
        orderBy: { hearingAt: 'asc' },
      });
      return rows.map(mapHearing);
    });
  }

  async listUpcoming(tenantId: string, days = 30): Promise<HearingDto[]> {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.courtHearing.findMany({
        where: { hearingAt: { gte: from, lte: to } },
        orderBy: { hearingAt: 'asc' },
        take: 100,
      });
      return rows.map(mapHearing);
    });
  }

  async create(tenantId: string, caseId: string, input: CreateHearingInput): Promise<HearingDto> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const caseRow = await tx.case.findFirst({ where: { id: caseId } });
      if (!caseRow) throw new NotFoundException('case not found');

      const row = await tx.courtHearing.create({
        data: {
          tenantId,
          caseId,
          courtName: input.courtName,
          judge: input.judge ?? null,
          hearingAt: new Date(input.hearingAt),
          location: input.location ?? null,
          notes: input.notes ?? null,
        },
      });
      return mapHearing(row);
    });
  }

  async update(tenantId: string, hearingId: string, input: UpdateHearingInput): Promise<HearingDto> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.courtHearing.findFirst({ where: { id: hearingId } });
      if (!current) throw new NotFoundException('hearing not found');

      const row = await tx.courtHearing.update({
        where: { id: hearingId },
        data: {
          ...(input.courtName !== undefined ? { courtName: input.courtName } : {}),
          ...(input.judge !== undefined ? { judge: input.judge ?? null } : {}),
          ...(input.hearingAt !== undefined ? { hearingAt: new Date(input.hearingAt) } : {}),
          ...(input.location !== undefined ? { location: input.location ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        },
      });
      return mapHearing(row);
    });
  }

  async delete(tenantId: string, hearingId: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.courtHearing.findFirst({ where: { id: hearingId } });
      if (!current) throw new NotFoundException('hearing not found');
      await tx.courtHearing.delete({ where: { id: hearingId } });
    });
  }
}

function mapHearing(row: {
  id: string;
  caseId: string;
  courtName: string;
  judge: string | null;
  hearingAt: Date;
  location: string | null;
  notes: string | null;
  reminderSentAt: Date | null;
  createdAt: Date;
}): HearingDto {
  return {
    id: row.id,
    caseId: row.caseId,
    courtName: row.courtName,
    judge: row.judge,
    hearingAt: row.hearingAt,
    location: row.location,
    notes: row.notes,
    reminderSentAt: row.reminderSentAt,
    createdAt: row.createdAt,
  };
}
