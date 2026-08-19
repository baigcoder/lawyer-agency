import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, Role } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { VerifiedToken } from './auth.ports';
import { isClerkOrgAdmin } from './clerk-claims';

export interface ResolvedPrincipal {
  tenantId: string;
  userId: string;
  clerkUserId: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
}

/** System roles seeded automatically for every tenant (D-017 / D-116). */
const USER_INCLUDE = {
  role: { include: { rolePermissions: { include: { permission: true } } } },
} as const satisfies Prisma.UserInclude;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

const SYSTEM_ROLES: Array<{ name: string; permissions: string[] }> = [
  { name: 'Admin', permissions: ['*'] },
  {
    name: 'Lawyer',
    permissions: [
      'cases:read',
      'cases:write',
      'messages:send',
      'appointments:manage',
      'appointments:read',
      'lawyers:read',
      'lawyers:write',
      'users:read',
      'inbox:read',
      'inbox:write',
      'analytics:read',
      'firm-profile:read',
      'whatsapp:read',
      'knowledge-base:read',
      'notifications:read',
      'notifications:write',
    ],
  },
  {
    name: 'Staff',
    permissions: [
      'cases:read',
      'messages:send',
      'appointments:read',
      'inbox:read',
      'users:read',
      'firm-profile:read',
      'whatsapp:read',
      'notifications:read',
    ],
  },
];

/**
 * Resolves a verified Clerk token to a tenant-scoped local principal.
 *
 * Membership is invite-only after the owner exists (D-116):
 * - Existing User matched by Clerk id (or invite email) keeps their role.
 * - Clerk org admin, or the first user on an empty tenant, becomes Admin.
 * - Anyone else is rejected — they are not auto-provisioned as Staff.
 */
@Injectable()
export class AuthService {
  constructor(private readonly uow: UnitOfWork) {}

  async resolvePrincipal(token: VerifiedToken): Promise<ResolvedPrincipal> {
    const clerkOrgId = token.clerkOrgId;
    if (!clerkOrgId) {
      throw new UnauthorizedException('Organization context required');
    }

    const tenant = await this.uow.withOrgContext(clerkOrgId, (tx) =>
      tx.tenant.findUnique({ where: { clerkOrgId } }),
    );

    if (!tenant) {
      throw new UnauthorizedException('Organization not registered in this platform');
    }

    return this.uow.withTenant(tenant.id, async (tx) => {
      await this.seedSystemRoles(tx, tenant.id);

      let user = await this.findExistingUser(tx, token);
      if (user?.status === 'INVITED') {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            clerkUserId: token.clerkUserId,
            status: 'ACTIVE',
            name: token.name ?? user.name,
            email: token.email ?? user.email,
          },
          include: USER_INCLUDE,
        });
      }

      if (!user) {
        user = await this.provisionOwnerIfAllowed(tx, tenant.id, token);
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User account is not active');
      }

      const permissions = Array.from(
        new Set(user.role.rolePermissions.map((rp) => rp.permission.code)),
      );

      return {
        tenantId: tenant.id,
        userId: user.id,
        clerkUserId: user.clerkUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      };
    });
  }

  /** Public so firm provisioning and team invite can share the same catalog. */
  async seedSystemRoles(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    for (const roleDef of SYSTEM_ROLES) {
      const permissions = await Promise.all(
        roleDef.permissions.map(async (code) => {
          const existingPerm = await tx.permission.findUnique({ where: { code } });
          if (existingPerm) return existingPerm;
          return tx.permission.create({ data: { code, description: code } });
        }),
      );

      const existing = await tx.role.findUnique({
        where: { tenantId_name: { tenantId, name: roleDef.name } },
        include: { rolePermissions: { include: { permission: true } } },
      });

      if (!existing) {
        await tx.role.create({
          data: {
            tenantId,
            name: roleDef.name,
            isSystem: true,
            rolePermissions: {
              create: permissions.map((p) => ({ tenantId, permissionId: p.id })),
            },
          },
        });
        continue;
      }

      const assigned = new Set(existing.rolePermissions.map((rp) => rp.permission.code));
      for (const perm of permissions) {
        if (assigned.has(perm.code)) continue;
        await tx.rolePermission.create({
          data: { tenantId, roleId: existing.id, permissionId: perm.id },
        });
      }
    }
  }

  private async findExistingUser(
    tx: Prisma.TransactionClient,
    token: VerifiedToken,
  ): Promise<UserWithRole | null> {
    const byClerkId = await tx.user.findUnique({
      where: { clerkUserId: token.clerkUserId },
      include: USER_INCLUDE,
    });
    if (byClerkId) return byClerkId;

    if (!token.email) return null;

    const byEmail = await tx.user.findFirst({
      where: { email: { equals: token.email, mode: 'insensitive' } },
      include: USER_INCLUDE,
    });
    if (!byEmail) return null;

    return tx.user.update({
      where: { id: byEmail.id },
      data: {
        clerkUserId: token.clerkUserId,
        name: token.name ?? byEmail.name,
        email: token.email,
      },
      include: USER_INCLUDE,
    });
  }

  private async provisionOwnerIfAllowed(
    tx: Prisma.TransactionClient,
    tenantId: string,
    token: VerifiedToken,
  ): Promise<UserWithRole> {
    const userCount = await tx.user.count();
    const allowOwner = userCount === 0 || isClerkOrgAdmin(token.clerkOrgRole);
    if (!allowOwner) {
      throw new ForbiddenException('You are not a member of this firm. Ask the owner to invite you.');
    }

    const adminRole = await tx.role.findUnique({
      where: { tenantId_name: { tenantId, name: 'Admin' } },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!adminRole) {
      throw new UnauthorizedException('Tenant has no Admin role');
    }

    return tx.user.create({
      data: {
        tenantId,
        clerkUserId: token.clerkUserId,
        roleId: adminRole.id,
        name: token.name ?? 'Firm owner',
        email: token.email ?? `${token.clerkUserId}@placeholder.local`,
        status: 'ACTIVE',
      },
      include: USER_INCLUDE,
    });
  }
}
