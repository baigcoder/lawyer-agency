import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Prisma } from '../../../generated/prisma/client';
import {
  PK_HOLIDAY_DATES,
  computeOpenSlots,
  type OpenSlot,
} from './slot-math';

export interface OpenSlotOffer {
  lawyerId: string;
  lawyerName: string;
  slots: OpenSlot[];
}

/**
 * Next open consultation slots from weekly lawyer availability minus
 * pending/confirmed bookings and Pakistan public holidays.
 */
@Injectable()
export class SlotFinderService {
  constructor(private readonly uow: UnitOfWork) {}

  async listOpenSlots(
    tenantId: string,
    params: {
      lawyerId?: string | undefined;
      assignedUserId?: string | null | undefined;
      caseId?: string | null | undefined;
      practiceArea?: string | undefined;
      now?: Date | undefined;
      horizonDays?: number | undefined;
      limit?: number | undefined;
    } = {},
  ): Promise<OpenSlotOffer | null> {
    const now = params.now ?? new Date();
    const horizonDays = params.horizonDays ?? 7;
    const limit = params.limit ?? 3;

    return this.uow.withTenant(tenantId, async (tx) => {
      const lawyer = await resolveLawyer(tx, {
        tenantId,
        lawyerId: params.lawyerId,
        assignedUserId: params.assignedUserId,
        caseId: params.caseId,
        practiceArea: params.practiceArea,
      });
      if (!lawyer) return null;

      const availability = await tx.lawyerAvailability.findMany({
        where: { lawyerId: lawyer.id },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      });
      if (availability.length === 0) {
        return { lawyerId: lawyer.id, lawyerName: lawyer.name, slots: [] };
      }

      const rangeEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
      const busyRows = await tx.appointment.findMany({
        where: {
          lawyerId: lawyer.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { lt: rangeEnd },
          endsAt: { gt: now },
        },
        select: { startsAt: true, endsAt: true },
      });

      const slots = computeOpenSlots({
        availability: availability.map((row) => ({
          weekday: row.weekday,
          startTime: row.startTime,
          endTime: row.endTime,
          slotDurationMinutes: row.slotDurationMinutes,
        })),
        busy: busyRows,
        holidays: PK_HOLIDAY_DATES,
        now,
        horizonDays,
        limit,
      });

      return { lawyerId: lawyer.id, lawyerName: lawyer.name, slots };
    });
  }
}

async function resolveLawyer(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    lawyerId?: string | undefined;
    assignedUserId?: string | null | undefined;
    caseId?: string | null | undefined;
    practiceArea?: string | undefined;
  },
): Promise<{ id: string; name: string } | null> {
  const includeUser = { user: { select: { name: true } } } as const;

  if (params.lawyerId) {
    const row = await tx.lawyer.findFirst({
      where: { id: params.lawyerId, tenantId: params.tenantId },
      include: includeUser,
    });
    return row ? { id: row.id, name: row.user.name } : null;
  }

  if (params.assignedUserId) {
    const row = await tx.lawyer.findFirst({
      where: { tenantId: params.tenantId, userId: params.assignedUserId },
      include: includeUser,
    });
    if (row) return { id: row.id, name: row.user.name };
  }

  if (params.caseId) {
    const primary = await tx.caseLawyer.findFirst({
      where: { caseId: params.caseId, role: 'primary' },
      include: { lawyer: { include: includeUser } },
    });
    if (primary?.lawyer) return { id: primary.lawyer.id, name: primary.lawyer.user.name };
  }

  const practiceArea = params.practiceArea?.trim();
  if (practiceArea) {
    const row = await tx.lawyer.findFirst({
      where: { tenantId: params.tenantId, practiceAreas: { has: practiceArea } },
      include: includeUser,
    });
    if (row) return { id: row.id, name: row.user.name };
  }

  const fallback = await tx.lawyer.findFirst({
    where: { tenantId: params.tenantId },
    include: includeUser,
    orderBy: { createdAt: 'asc' },
  });
  return fallback ? { id: fallback.id, name: fallback.user.name } : null;
}
