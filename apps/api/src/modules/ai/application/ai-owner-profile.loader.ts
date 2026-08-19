import type { Prisma } from '../../../generated/prisma/client';
import type { OwnerProfileSnapshot } from './ai-context.types';

/** Load the Admin user's lawyer profile + AI-visible highlights (T1-safe). */
export async function loadOwnerProfileForAi(
  tx: Prisma.TransactionClient,
): Promise<OwnerProfileSnapshot | null> {
  const adminRole = await tx.role.findFirst({ where: { name: 'Admin' } });
  if (!adminRole) return null;

  const adminUser = await tx.user.findFirst({
    where: { roleId: adminRole.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) return null;

  const lawyer = await tx.lawyer.findFirst({
    where: { userId: adminUser.id },
    include: {
      user: true,
      caseHighlights: {
        where: { visibleToAi: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!lawyer) return null;

  return {
    ownerName: adminUser.name,
    bio: lawyer.bio ?? '',
    bioUr: lawyer.bioUr ?? '',
    yearsExperience: lawyer.yearsExperience,
    barCouncil: lawyer.barCouncil ?? '',
    barEnrollmentNumber: lawyer.barEnrollmentNumber ?? '',
    education: lawyer.education,
    achievements: lawyer.achievements,
    languages: lawyer.languages,
    practiceAreas: lawyer.practiceAreas,
    featuredCases: lawyer.caseHighlights.map((h) => ({
      publicTitle: h.publicTitle,
      publicOutcome: h.publicOutcome,
    })),
  };
}
