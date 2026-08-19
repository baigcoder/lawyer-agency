import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { AuthService } from '../../auth/application/auth.service';
import type { OrganizationInviter } from '../../auth/application/auth.ports';

function makeService() {
  const users: Record<string, unknown>[] = [];
  const roles = new Map<string, { id: string; tenantId: string; name: string }>();
  roles.set('r-staff', { id: 'r-staff', tenantId: 't1', name: 'Staff' });
  roles.set('r-admin', { id: 'r-admin', tenantId: 't1', name: 'Admin' });

  const tx = {
    user: {
      findMany: vi.fn(async () => users.map((u) => ({ ...u, role: roles.get(u.roleId as string) }))),
      findFirst: vi.fn(async (args: { where: { id?: string; email?: { equals: string } } }) => {
        const found = args.where.id
          ? users.find((u) => u.id === args.where.id)
          : args.where.email?.equals
            ? users.find((u) => String(u.email).toLowerCase() === args.where.email?.equals.toLowerCase())
            : undefined;
        if (!found) return null;
        return { ...found, role: roles.get(found.roleId as string), phone: found.phone ?? null };
      }),
      findUnique: vi.fn(async (args: { where: { id?: string; clerkUserId?: string } }) =>
        users.find((u) => u.id === args.where.id || u.clerkUserId === args.where.clerkUserId) ?? null,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const u = { id: `u-${users.length + 1}`, createdAt: new Date(), ...args.data };
        users.push(u);
        return { ...u, role: roles.get(u.roleId as string) };
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = users.findIndex((u) => u.id === args.where.id);
        if (idx === -1) throw new Error('not found');
        users[idx] = { ...users[idx], ...args.data };
        return { ...users[idx], role: roles.get(users[idx].roleId as string) };
      }),
    },
    role: {
      findUnique: vi.fn(async (args: { where: { id?: string; tenantId_name?: { tenantId: string; name: string } } }) => {
        if (args.where.id) return roles.get(args.where.id) ?? null;
        for (const r of roles.values()) {
          if (r.tenantId === args.where.tenantId_name?.tenantId && r.name === args.where.tenantId_name?.name) return r;
        }
        return null;
      }),
      findMany: vi.fn(async () => Array.from(roles.values()).map((r) => ({ ...r, isSystem: true }))),
    },
    tenant: {
      findUnique: vi.fn(async () => ({ clerkOrgId: 'org_1' })),
    },
    outboxEvent: { create: vi.fn(async () => ({})) },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const outbox = { append: vi.fn(async () => undefined) } as unknown as OutboxWriter;
  const auth = { seedSystemRoles: vi.fn(async () => undefined) } as unknown as AuthService;
  const orgInviter: OrganizationInviter = { inviteMember: vi.fn(async () => undefined) };
  return { service: new UsersService(uow, outbox, auth, orgInviter), tx, users, outbox, orgInviter };
}

describe('UsersService', () => {
  it('lists roles for the tenant', async () => {
    const { service, tx } = makeService();
    tx.role.findMany = vi.fn(async () => [
      { id: 'r-admin', name: 'Admin', isSystem: true },
      { id: 'r-lawyer', name: 'Lawyer', isSystem: true },
    ]);
    const roles = await service.listRoles('t1');
    expect(roles).toHaveLength(2);
    expect(roles[0]?.name).toBe('Admin');
  });

  it('invites a user and appends UserInvited event', async () => {
    const { service, tx, outbox, orgInviter } = makeService();
    const created = await service.invite('t1', {
      name: 'Ayesha Khan',
      email: 'ayesha@firm.pk',
      roleId: 'r-staff',
      clerkUserId: 'clerk-1',
    });
    expect(created.status).toBe('INVITED');
    expect(tx.user.create).toHaveBeenCalledOnce();
    expect(outbox.append).toHaveBeenCalledWith(tx, 't1', 'user.invited', expect.objectContaining({ email: 'ayesha@firm.pk' }));
    expect(orgInviter.inviteMember).toHaveBeenCalledWith({
      clerkOrgId: 'org_1',
      email: 'ayesha@firm.pk',
      role: 'org:member',
    });
  });

  it('resends a Clerk invite when the same email is still pending', async () => {
    const { service, tx, orgInviter } = makeService();
    await service.invite('t1', {
      name: 'Ayesha Khan',
      email: 'ayesha@firm.pk',
      roleId: 'r-staff',
      clerkUserId: 'clerk-1',
    });
    const again = await service.invite('t1', {
      name: 'Ayesha Khan',
      email: 'ayesha@firm.pk',
      roleId: 'r-staff',
    });
    expect(again.status).toBe('INVITED');
    expect(tx.user.create).toHaveBeenCalledOnce();
    expect(orgInviter.inviteMember).toHaveBeenCalledTimes(2);
  });

  it('resendInvite sends a Clerk invitation without creating another user', async () => {
    const { service, tx, orgInviter } = makeService();
    const created = await service.invite('t1', {
      name: 'Ayesha Khan',
      email: 'ayesha@firm.pk',
      roleId: 'r-staff',
      clerkUserId: 'clerk-1',
    });
    await service.resendInvite('t1', created.id, 'user_owner');
    expect(tx.user.create).toHaveBeenCalledOnce();
    expect(orgInviter.inviteMember).toHaveBeenCalledTimes(2);
    expect(orgInviter.inviteMember).toHaveBeenLastCalledWith({
      clerkOrgId: 'org_1',
      email: 'ayesha@firm.pk',
      role: 'org:member',
      inviterUserId: 'user_owner',
    });
  });

  it('keeps the local invited user if Clerk invitation sending fails', async () => {
    const { service, tx, orgInviter } = makeService();
    orgInviter.inviteMember = vi.fn(async () => {
      throw new Error('clerk unavailable');
    });
    await expect(
      service.invite('t1', { name: 'A', email: 'a@x.com', roleId: 'r-staff', clerkUserId: 'c1' }),
    ).rejects.toThrow(/Could not send the Clerk organization invitation/);
    expect(tx.user.create).toHaveBeenCalledOnce();
  });

  it('skips placeholder invite_ clerk ids when sending the Clerk invitation', async () => {
    const { service, orgInviter } = makeService();
    await service.invite(
      't1',
      { name: 'A', email: 'a@x.com', roleId: 'r-staff' },
      'invite_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(orgInviter.inviteMember).toHaveBeenCalledWith({
      clerkOrgId: 'org_1',
      email: 'a@x.com',
      role: 'org:member',
    });
  });

  it('lists active users with role names', async () => {
    const { service } = makeService();
    await service.invite('t1', { name: 'A', email: 'a@x.com', roleId: 'r-staff', clerkUserId: 'c1' });
    const active = await service.listActive('t1');
    expect(active).toHaveLength(1);
    expect(active[0].roleName).toBe('Staff');
  });

  it('changes role and appends UserRoleChanged', async () => {
    const { service, outbox } = makeService();
    const u = await service.invite('t1', { name: 'B', email: 'b@x.com', roleId: 'r-staff', clerkUserId: 'c2' });
    await service.update('t1', u.id, { roleId: 'r-admin' });
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'user.role.changed', expect.objectContaining({ userId: u.id, toRoleId: 'r-admin' }));
  });

  it('rejects resendInvite for users who already joined', async () => {
    const { service } = makeService();
    const u = await service.invite('t1', { name: 'C', email: 'c@x.com', roleId: 'r-staff', clerkUserId: 'c3' });
    await service.update('t1', u.id, { status: 'ACTIVE' });
    await expect(service.resendInvite('t1', u.id)).rejects.toThrow(/Only pending invitations/);
  });

  it('deactivates a user', async () => {
    const { service, outbox } = makeService();
    const u = await service.invite('t1', { name: 'C', email: 'c@x.com', roleId: 'r-staff', clerkUserId: 'c3' });
    await service.deactivate('t1', u.id);
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'user.deactivated', expect.objectContaining({ userId: u.id }));
  });

  it('throws when role not found on invite', async () => {
    const { service } = makeService();
    await expect(
      service.invite('t1', { name: 'X', email: 'x@x.com', roleId: 'missing', clerkUserId: 'c4' }),
    ).rejects.toThrow();
  });
});