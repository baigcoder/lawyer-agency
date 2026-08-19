import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { AuthService } from './application/auth.service';
import { UnitOfWork } from '../../common/prisma/unit-of-work';

interface FakePrincipal {
  id: string;
  tenantId: string;
  userId: string;
  clerkUserId: string;
  name?: string;
  email?: string;
  status?: string;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    rolePermissions: Array<{ permission: { code: string } }>;
  };
  permissions: string[];
}

function makeRole(name: string, permissions: string[] = []): FakePrincipal['role'] {
  return {
    id: `role-${name.toLowerCase()}`,
    name,
    isSystem: true,
    rolePermissions: permissions.map((code) => ({ permission: { code } })),
  };
}

function mockUow(stubs: {
  tenant?: { id: string; clerkOrgId: string | null } | null;
  user?: FakePrincipal | null;
  emailUser?: FakePrincipal | null;
  userCount?: number;
  seedRoles?: Array<{ id: string; name: string }>;
} = {}) {
  const tenant = stubs.tenant === undefined ? { id: 'tenant-1', clerkOrgId: 'org_1' } : stubs.tenant;
  let user: FakePrincipal | null = stubs.user ?? null;
  const createdPermissions: Array<{ id: string; code: string }> = [];
  const createdRoles: Array<{ id: string; name: string }> = stubs.seedRoles ?? [];

  const tx = {
    tenant: { findUnique: vi.fn(async () => tenant) },
    user: {
      findUnique: vi.fn(async () => user),
      findFirst: vi.fn(async () => stubs.emailUser ?? null),
      count: vi.fn(async () => stubs.userCount ?? (user ? 1 : 0)),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const roleId = String(args.data.roleId);
        const named = createdRoles.find((r) => r.id === roleId);
        const roleName = named?.name ?? 'Admin';
        user = {
          id: 'user-new',
          tenantId: tenant?.id ?? 'tenant-1',
          userId: 'user-new',
          clerkUserId: String(args.data.clerkUserId),
          name: String(args.data.name),
          email: String(args.data.email),
          status: 'ACTIVE',
          role: makeRole(roleName, roleName === 'Admin' ? ['*'] : ['cases:read']),
          permissions: roleName === 'Admin' ? ['*'] : ['cases:read'],
        };
        return user as unknown as never;
      }),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const source = user ?? stubs.emailUser;
        if (!source) throw new Error('no user to update');
        user = {
          ...source,
          clerkUserId: String(args.data.clerkUserId ?? source.clerkUserId),
          status: String(args.data.status ?? source.status),
          name: String(args.data.name ?? source.name ?? 'A'),
          email: String(args.data.email ?? source.email ?? 'a@firm.com'),
        };
        return user as unknown as never;
      }),
    },
    role: {
      findUnique: vi.fn(async (args: { where: { tenantId_name: { name: string } } }) => {
        const name = args.where.tenantId_name.name;
        const found = createdRoles.find((r) => r.name === name);
        return found
          ? {
              ...found,
              isSystem: true,
              rolePermissions: createdPermissions.map((p) => ({ permission: p })),
            }
          : null;
      }),
      create: vi.fn(async (args: { data: { name: string } }) => {
        const role = { id: `role-${args.data.name.toLowerCase()}`, name: args.data.name };
        createdRoles.push(role);
        return role;
      }),
    },
    rolePermission: {
      create: vi.fn(async () => ({})),
    },
    permission: {
      findUnique: vi.fn(async (args: { where: { code: string } }) =>
        createdPermissions.find((p) => p.code === args.where.code),
      ),
      create: vi.fn(async (args: { data: { code: string } }) => {
        const perm = { id: `perm-${args.data.code}`, code: args.data.code };
        createdPermissions.push(perm);
        return perm;
      }),
    },
  } as unknown as Prisma.TransactionClient;

  return {
    uow: {
      withPlatform: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
      withTenant: vi.fn(async <T>(_tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
      withOrgContext: vi.fn(async <T>(_clerkOrgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
    } as unknown as UnitOfWork,
    tx,
  };
}

describe('AuthService', () => {
  it('resolves an existing active user', async () => {
    const { uow } = mockUow({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        clerkUserId: 'clerk_user_1',
        status: 'ACTIVE',
        role: makeRole('Lawyer', ['cases:read', 'cases:write']),
        permissions: ['cases:read', 'cases:write'],
      },
    });
    const service = new AuthService(uow);

    const principal = await service.resolvePrincipal({
      clerkUserId: 'clerk_user_1',
      clerkOrgId: 'org_1',
      email: 'a@firm.com',
      name: 'A',
    });

    expect(principal.tenantId).toBe('tenant-1');
    expect(principal.userId).toBe('user-1');
    expect(principal.permissions).toContain('cases:read');
  });

  it('rejects when organization is not mapped to a tenant', async () => {
    const { uow } = mockUow({ tenant: null });
    const service = new AuthService(uow);

    await expect(
      service.resolvePrincipal({ clerkUserId: 'u', clerkOrgId: 'org_unknown' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when organization context is missing', async () => {
    const { uow } = mockUow();
    const service = new AuthService(uow);

    await expect(
      service.resolvePrincipal({ clerkUserId: 'u', clerkOrgId: null }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('provisions an Admin owner on first login when the tenant has no users', async () => {
    const { uow, tx } = mockUow({ userCount: 0 });
    const service = new AuthService(uow);

    const principal = await service.resolvePrincipal({
      clerkUserId: 'clerk_new',
      clerkOrgId: 'org_1',
      clerkOrgRole: 'org:admin',
      email: 'owner@firm.com',
      name: 'Owner',
    });

    expect(principal.clerkUserId).toBe('clerk_new');
    expect(principal.permissions).toContain('*');
    expect(tx.role.create).toHaveBeenCalledTimes(3);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clerkUserId: 'clerk_new', status: 'ACTIVE' }),
      }),
    );
  });

  it('rejects unknown org members who were not invited', async () => {
    const { uow } = mockUow({ userCount: 1 });
    const service = new AuthService(uow);

    await expect(
      service.resolvePrincipal({
        clerkUserId: 'clerk_stranger',
        clerkOrgId: 'org_1',
        clerkOrgRole: 'org:member',
        email: 'stranger@firm.com',
        name: 'Stranger',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('activates an invited lawyer matched by email', async () => {
    const invited = {
      id: 'user-invited',
      tenantId: 'tenant-1',
      userId: 'user-invited',
      clerkUserId: 'invite_placeholder',
      name: 'Ayesha',
      email: 'ayesha@firm.pk',
      status: 'INVITED',
      role: makeRole('Lawyer', ['cases:read', 'inbox:read']),
      permissions: ['cases:read', 'inbox:read'],
    };
    const { uow, tx } = mockUow({ emailUser: invited, userCount: 1 });
    const service = new AuthService(uow);

    const principal = await service.resolvePrincipal({
      clerkUserId: 'clerk_ayesha',
      clerkOrgId: 'org_1',
      clerkOrgRole: 'org:member',
      email: 'ayesha@firm.pk',
      name: 'Ayesha Khan',
    });

    expect(principal.userId).toBe('user-invited');
    expect(tx.user.update).toHaveBeenCalled();
    expect(principal.permissions).toContain('cases:read');
  });

  it('rejects inactive users', async () => {
    const { uow } = mockUow({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        clerkUserId: 'clerk_user_1',
        status: 'INACTIVE',
        role: makeRole('Staff'),
        permissions: [],
      },
    });
    const service = new AuthService(uow);

    await expect(
      service.resolvePrincipal({ clerkUserId: 'clerk_user_1', clerkOrgId: 'org_1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
