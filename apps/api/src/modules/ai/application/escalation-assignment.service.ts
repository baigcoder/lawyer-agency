import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

/**
 * Picks a staff user to assign when AI escalates to human review.
 */
@Injectable()
export class EscalationAssignmentService {
  async resolveAssigneeUserId(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      caseId: string | null | undefined;
      practiceArea?: string | undefined;
    },
  ): Promise<string | null> {
    if (params.caseId) {
      const caseLawyer = await tx.caseLawyer.findFirst({
        where: { caseId: params.caseId, role: 'primary' },
        include: { lawyer: { select: { userId: true } } },
      });
      if (caseLawyer?.lawyer.userId) return caseLawyer.lawyer.userId;
    }

    const practiceArea = params.practiceArea?.trim();
    if (practiceArea) {
      const lawyer = await tx.lawyer.findFirst({
        where: {
          tenantId: params.tenantId,
          practiceAreas: { has: practiceArea },
        },
        select: { userId: true },
      });
      if (lawyer?.userId) return lawyer.userId;
    }

    const lawyerRole = await tx.role.findFirst({
      where: { tenantId: params.tenantId, name: 'Lawyer' },
      select: { id: true },
    });
    if (!lawyerRole) return null;

    const user = await tx.user.findFirst({
      where: { tenantId: params.tenantId, roleId: lawyerRole.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return user?.id ?? null;
  }
}
