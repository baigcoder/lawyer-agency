import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type {
  CreateCaseHighlightInput,
  LawyerProfileInput,
  UpdateCaseHighlightInput,
} from './dto';

export interface LawyerProfileView {
  lawyerId: string;
  userId: string;
  name: string;
  email: string;
  practiceAreas: string[];
  whatsappNumber: string | null;
  bio: string;
  bioUr: string;
  yearsExperience: number | null;
  barCouncil: string;
  barEnrollmentNumber: string;
  education: string[];
  achievements: string[];
  languages: string[];
  profileCompletedAt: string | null;
  caseHighlights: CaseHighlightView[];
}

export interface CaseHighlightView {
  id: string;
  caseId: string;
  caseReference: string;
  matterType: string;
  publicTitle: string;
  publicOutcome: string;
  consentRecordedAt: string;
  visibleToAi: boolean;
}

export interface ClosedCaseOption {
  id: string;
  reference: string;
  matterType: string;
  closedAt: string | null;
}

function isProfileComplete(input: LawyerProfileInput): boolean {
  return Boolean(input.bio?.trim() || input.bioUr?.trim()) && input.yearsExperience != null;
}

@Injectable()
export class LawyerProfileService {
  constructor(private readonly uow: UnitOfWork) {}

  async getMyProfile(tenantId: string, userId: string): Promise<LawyerProfileView> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId } });
      if (!user) throw new NotFoundException('user not found');

      const lawyer = await tx.lawyer.findFirst({
        where: { userId },
        include: {
          user: true,
          caseHighlights: {
            include: { case: { select: { reference: true, matterType: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!lawyer) {
        return {
          lawyerId: '',
          userId: user.id,
          name: user.name,
          email: user.email,
          practiceAreas: [],
          whatsappNumber: null,
          bio: '',
          bioUr: '',
          yearsExperience: null,
          barCouncil: '',
          barEnrollmentNumber: '',
          education: [],
          achievements: [],
          languages: [],
          profileCompletedAt: null,
          caseHighlights: [],
        };
      }

      return this.toProfileView(lawyer);
    });
  }

  async updateMyProfile(
    tenantId: string,
    userId: string,
    input: LawyerProfileInput,
    canCreateLawyer: boolean,
  ): Promise<LawyerProfileView> {
    return this.uow.withTenant(tenantId, async (tx) => {
      let lawyer = await tx.lawyer.findFirst({
        where: { userId },
        include: {
          user: true,
          caseHighlights: {
            where: { visibleToAi: true },
            include: { case: { select: { reference: true, matterType: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!lawyer) {
        if (!canCreateLawyer) {
          throw new ForbiddenException('Only firm admins can create an owner profile without a lawyer record');
        }
        const user = await tx.user.findFirst({ where: { id: userId } });
        if (!user) throw new NotFoundException('user not found');
        lawyer = await tx.lawyer.create({
          data: {
            tenantId,
            userId,
            practiceAreas: input.practiceAreas ?? [],
          },
          include: {
            user: true,
            caseHighlights: {
              where: { visibleToAi: true },
              include: { case: { select: { reference: true, matterType: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        });
      }

      const profileCompletedAt = isProfileComplete(input) ? new Date() : null;
      const updated = await tx.lawyer.update({
        where: { id: lawyer.id },
        data: {
          bio: input.bio?.trim() || null,
          bioUr: input.bioUr?.trim() || null,
          yearsExperience: input.yearsExperience ?? null,
          barCouncil: input.barCouncil?.trim() || null,
          barEnrollmentNumber: input.barEnrollmentNumber?.trim() || null,
          education: input.education ?? [],
          achievements: input.achievements ?? [],
          languages: input.languages ?? [],
          ...(input.practiceAreas !== undefined ? { practiceAreas: input.practiceAreas } : {}),
          profileCompletedAt,
        },
        include: {
          user: true,
          caseHighlights: {
            include: { case: { select: { reference: true, matterType: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return this.toProfileView(updated);
    });
  }

  async listClosedCasesForPicker(tenantId: string, userId: string): Promise<ClosedCaseOption[]> {
    const lawyer = await this.uow.withTenant(tenantId, async (tx) =>
      tx.lawyer.findFirst({ where: { userId } }),
    );
    if (!lawyer) return [];

    return this.uow.withTenant(tenantId, async (tx) => {
      const highlighted = await tx.lawyerCaseHighlight.findMany({
        where: { lawyerId: lawyer.id },
        select: { caseId: true },
      });
      const highlightedIds = new Set(highlighted.map((h) => h.caseId));

      const cases = await tx.case.findMany({
        where: { status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        take: 100,
        select: { id: true, reference: true, matterType: true, closedAt: true },
      });

      return cases
        .filter((c) => !highlightedIds.has(c.id))
        .map((c) => ({
          id: c.id,
          reference: c.reference,
          matterType: c.matterType,
          closedAt: c.closedAt?.toISOString() ?? null,
        }));
    });
  }

  async createCaseHighlight(
    tenantId: string,
    userId: string,
    input: CreateCaseHighlightInput,
  ): Promise<CaseHighlightView> {
    const lawyer = await this.requireLawyer(tenantId, userId);

    return this.uow.withTenant(tenantId, async (tx) => {
      const caseRow = await tx.case.findFirst({ where: { id: input.caseId } });
      if (!caseRow) throw new NotFoundException('case not found');
      if (caseRow.status !== 'CLOSED') {
        throw new BadRequestException('Only closed cases can be featured on your profile');
      }

      const created = await tx.lawyerCaseHighlight.create({
        data: {
          tenantId,
          lawyerId: lawyer.id,
          caseId: input.caseId,
          publicTitle: input.publicTitle,
          publicOutcome: input.publicOutcome,
          consentRecordedAt: new Date(),
          visibleToAi: input.visibleToAi,
        },
        include: { case: { select: { reference: true, matterType: true } } },
      });

      return this.toHighlightView(created);
    });
  }

  async deleteCaseHighlight(tenantId: string, userId: string, highlightId: string): Promise<void> {
    const lawyer = await this.requireLawyer(tenantId, userId);

    return this.uow.withTenant(tenantId, async (tx) => {
      const row = await tx.lawyerCaseHighlight.findFirst({
        where: { id: highlightId, lawyerId: lawyer.id },
      });
      if (!row) throw new NotFoundException('case highlight not found');
      await tx.lawyerCaseHighlight.delete({ where: { id: highlightId } });
    });
  }

  async updateCaseHighlight(
    tenantId: string,
    userId: string,
    highlightId: string,
    input: UpdateCaseHighlightInput,
  ): Promise<CaseHighlightView> {
    const lawyer = await this.requireLawyer(tenantId, userId);

    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.lawyerCaseHighlight.findFirst({
        where: { id: highlightId, lawyerId: lawyer.id },
      });
      if (!existing) throw new NotFoundException('case highlight not found');

      const updated = await tx.lawyerCaseHighlight.update({
        where: { id: highlightId },
        data: {
          ...(input.publicTitle !== undefined ? { publicTitle: input.publicTitle } : {}),
          ...(input.publicOutcome !== undefined ? { publicOutcome: input.publicOutcome } : {}),
          ...(input.visibleToAi !== undefined ? { visibleToAi: input.visibleToAi } : {}),
        },
        include: { case: { select: { reference: true, matterType: true } } },
      });

      return this.toHighlightView(updated);
    });
  }

  /** Load the Admin user's lawyer profile + AI-visible highlights for the orchestrator. */
  async getOwnerProfileForAi(tx: Parameters<Parameters<UnitOfWork['withTenant']>[1]>[0]) {
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

  private async requireLawyer(tenantId: string, userId: string) {
    const lawyer = await this.uow.withTenant(tenantId, async (tx) =>
      tx.lawyer.findFirst({ where: { userId } }),
    );
    if (!lawyer) throw new NotFoundException('lawyer profile not found — save your profile first');
    return lawyer;
  }

  private toProfileView(lawyer: {
    id: string;
    userId: string;
    practiceAreas: string[];
    whatsappNumber: string | null;
    bio: string | null;
    bioUr: string | null;
    yearsExperience: number | null;
    barCouncil: string | null;
    barEnrollmentNumber: string | null;
    education: string[];
    achievements: string[];
    languages: string[];
    profileCompletedAt: Date | null;
    user: { name: string; email: string };
    caseHighlights: Array<{
      id: string;
      caseId: string;
      publicTitle: string;
      publicOutcome: string;
      consentRecordedAt: Date;
      visibleToAi: boolean;
      case: { reference: string; matterType: string };
    }>;
  }): LawyerProfileView {
    return {
      lawyerId: lawyer.id,
      userId: lawyer.userId,
      name: lawyer.user.name,
      email: lawyer.user.email,
      practiceAreas: lawyer.practiceAreas,
      whatsappNumber: lawyer.whatsappNumber,
      bio: lawyer.bio ?? '',
      bioUr: lawyer.bioUr ?? '',
      yearsExperience: lawyer.yearsExperience,
      barCouncil: lawyer.barCouncil ?? '',
      barEnrollmentNumber: lawyer.barEnrollmentNumber ?? '',
      education: lawyer.education,
      achievements: lawyer.achievements,
      languages: lawyer.languages,
      profileCompletedAt: lawyer.profileCompletedAt?.toISOString() ?? null,
      caseHighlights: lawyer.caseHighlights.map((h) => this.toHighlightView(h)),
    };
  }

  private toHighlightView(h: {
    id: string;
    caseId: string;
    publicTitle: string;
    publicOutcome: string;
    consentRecordedAt: Date;
    visibleToAi: boolean;
    case: { reference: string; matterType: string };
  }): CaseHighlightView {
    return {
      id: h.id,
      caseId: h.caseId,
      caseReference: h.case.reference,
      matterType: h.case.matterType,
      publicTitle: h.publicTitle,
      publicOutcome: h.publicOutcome,
      consentRecordedAt: h.consentRecordedAt.toISOString(),
      visibleToAi: h.visibleToAi,
    };
  }
}
