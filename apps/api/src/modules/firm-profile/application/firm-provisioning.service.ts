import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';
import { AuthService } from '../../auth/application/auth.service';
import type { ProvisionFirmInput } from './dto';

export interface ProvisionIdentity {
  firmName: string;
  clerkOrgId: string;
  clerkUserId: string;
  email: string | null;
  name: string | null;
}

const DEFAULT_LANGUAGES = ['EN', 'UR', 'ROMAN_URDU'] as const;

/**
 * Creates (or completes) a firm tenant from the onboarding wizard (D-093).
 * Idempotent: re-provisioning an existing org merges wizard fields into the
 * tenant's settings and returns the existing tenant id. System roles (Admin,
 * Lawyer, Staff) and the first Admin user are created exactly once, on first
 * provision (D-116).
 */
@Injectable()
export class FirmProvisioningService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly auth: AuthService,
  ) {}

  async provision(input: ProvisionFirmInput & ProvisionIdentity): Promise<{ tenantId: string }> {
    const existing = await this.uow.withOrgContext(input.clerkOrgId, (tx) =>
      tx.tenant.findUnique({ where: { clerkOrgId: input.clerkOrgId }, select: { id: true, settings: true } }),
    );
    if (existing) {
      await this.uow.withTenant(existing.id, (tx) =>
        tx.tenant.update({
          where: { id: existing.id },
          data: { name: input.firmName, settings: this.mergeSettings(existing.settings, input) },
        }),
      );
      return { tenantId: existing.id };
    }

    const slug = `${input.firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'firm'}-${randomUUID().slice(0, 8)}`;
    const settings = this.wizardSettings(input);
    const tenant = await this.uow.withOrgContext(input.clerkOrgId, async (tx) => {
      try {
        return await tx.tenant.create({
          data: { name: input.firmName, slug, clerkOrgId: input.clerkOrgId, settings },
        });
      } catch {
        throw new ConflictException('Could not create firm organization');
      }
    });
    await this.uow.withTenant(tenant.id, async (tx) => {
      await this.auth.seedSystemRoles(tx, tenant.id);
      const adminRole = await tx.role.findUnique({
        where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
      });
      if (!adminRole) throw new ConflictException('Could not seed the Admin role');
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          clerkUserId: input.clerkUserId,
          roleId: adminRole.id,
          name: input.adminName ?? input.name ?? 'Firm administrator',
          email: input.adminEmail || input.email || `${input.clerkUserId}@placeholder.local`,
          status: 'ACTIVE',
        },
      });
    });
    return { tenantId: tenant.id };
  }

  /** Whether this Clerk org is already registered as a tenant. */
  async status(clerkOrgId: string): Promise<{ provisioned: boolean; tenantId: string | null }> {
    const tenant = await this.uow.withOrgContext(clerkOrgId, (tx) =>
      tx.tenant.findUnique({ where: { clerkOrgId }, select: { id: true } }),
    );
    return { provisioned: Boolean(tenant), tenantId: tenant?.id ?? null };
  }

  /** Dev seam status lookup by tenant id (D-037). */
  async statusByTenantId(tenantId: string): Promise<{ provisioned: boolean; tenantId: string | null }> {
    const tenant = await this.uow.withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    );
    return { provisioned: Boolean(tenant), tenantId: tenant?.id ?? null };
  }

  /** Dev seam provision: update the pre-seeded tenant's profile (D-037). */
  async provisionDev(tenantId: string, input: ProvisionFirmInput): Promise<{ tenantId: string }> {
    await this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!existing) throw new ConflictException('Dev seam tenant not found');
      await tx.tenant.update({
        where: { id: tenantId },
        data: { name: input.firmName, settings: this.mergeSettings(existing.settings, input) },
      });
    });
    return { tenantId };
  }

  /** New-tenant settings from the wizard; missing fields get defaults. */
  private wizardSettings(input: ProvisionFirmInput): Prisma.InputJsonValue {
    return toInputJson({
      city: input.city ?? '',
      displayName: input.displayName ?? input.firmName,
      officeAddress: input.officeAddress ?? '',
      website: input.website ?? '',
      practiceAreas: input.practiceAreas ?? [],
      clientLanguages: input.clientLanguages ?? DEFAULT_LANGUAGES,
      officeHours: input.officeHours ?? 'Mon–Sat, 9:00–18:00 PKT',
      teamSize: input.teamSize ?? 1,
    });
  }

  /** Re-provisioning an existing tenant merges only the fields the wizard
   *  supplied, preserving anything already stored. */
  private mergeSettings(prior: unknown, input: ProvisionFirmInput): Prisma.InputJsonValue {
    const base = asRecord(prior);
    const merged: Record<string, unknown> = { ...base };
    const supplied: Record<string, unknown> = {
      city: input.city,
      displayName: input.displayName,
      officeAddress: input.officeAddress,
      website: input.website,
      practiceAreas: input.practiceAreas,
      clientLanguages: input.clientLanguages,
      officeHours: input.officeHours,
      teamSize: input.teamSize,
    };
    for (const [key, value] of Object.entries(supplied)) {
      if (value !== undefined) merged[key] = value;
    }
    return toInputJson(merged);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
