import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { AuthService } from '../../auth/application/auth.service';
import { ORGANIZATION_INVITER, type OrganizationInviter } from '../../auth/application/auth.ports';
import type { InviteUserInput, ListUsersQuery, UpdateUserInput } from './dto';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleName: string;
  roleId: string;
  status: string;
  createdAt: Date;
}

export interface UserDetail extends UserSummary {
  clerkUserId: string;
  isLawyer: boolean;
  lawyerId: string | null;
}

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
}

/**
 * User management surface for the dashboard.
 * Phase 11: read-only active list for inbox assignment.
 * Phase 16: full CRUD — invite, role change, status, deactivation.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    private readonly auth: AuthService,
    @Inject(ORGANIZATION_INVITER) private readonly orgInviter: OrganizationInviter,
  ) {}

  async listRoles(tenantId: string): Promise<RoleSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.role.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, isSystem: true },
      });
      return rows;
    });
  }

  async listActive(tenantId: string): Promise<UserSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.user.findMany({
        where: { status: 'ACTIVE' },
        include: { role: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleName: u.role.name,
        roleId: u.role.id,
        status: u.status,
        createdAt: u.createdAt,
      }));
    });
  }

  async list(tenantId: string, query: ListUsersQuery): Promise<UserSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.user.findMany({
        where: query.status ? { status: query.status } : {},
        include: { role: true },
        orderBy: { name: 'asc' },
        take: query.limit,
        skip: query.offset,
      });
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleName: u.role.name,
        roleId: u.role.id,
        status: u.status,
        createdAt: u.createdAt,
      }));
    });
  }

  async getById(tenantId: string, userId: string): Promise<UserDetail> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const u = await tx.user.findFirst({
        where: { id: userId },
        include: { role: true, lawyer: true },
      });
      if (!u) throw new NotFoundException('user not found');
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        clerkUserId: u.clerkUserId,
        roleName: u.role.name,
        roleId: u.role.id,
        status: u.status,
        createdAt: u.createdAt,
        isLawyer: u.lawyer !== null,
        lawyerId: u.lawyer?.id ?? null,
      };
    });
  }

  async invite(
    tenantId: string,
    input: InviteUserInput,
    inviterClerkUserId?: string,
  ): Promise<UserSummary> {
    const prepared = await this.uow.withTenant(tenantId, async (tx) => {
      await this.auth.seedSystemRoles(tx, tenantId);

      const role = await tx.role.findUnique({ where: { id: input.roleId } });
      if (!role || role.tenantId !== tenantId) {
        throw new NotFoundException('role not found');
      }

      const duplicate = await tx.user.findFirst({
        where: { email: { equals: input.email, mode: 'insensitive' } },
        include: { role: true },
      });
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { clerkOrgId: true },
      });
      const clerkRole = role.name === 'Admin' ? ('org:admin' as const) : ('org:member' as const);

      if (duplicate) {
        if (duplicate.status === 'INVITED') {
          return {
            user: toSummary(duplicate),
            clerkOrgId: tenant?.clerkOrgId ?? null,
            clerkRole,
            resent: true,
          };
        }
        throw new ConflictException('A user with this email is already on the team');
      }

      const created = await tx.user.create({
        data: {
          tenantId,
          clerkUserId: input.clerkUserId ?? `invite_${randomUUID()}`,
          roleId: input.roleId,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          status: 'INVITED',
        },
        include: { role: true },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.UserInvited, {
        userId: created.id,
        email: created.email,
        roleId: created.roleId,
      });

      return {
        user: toSummary(created),
        clerkOrgId: tenant?.clerkOrgId ?? null,
        clerkRole,
        resent: false,
      };
    });

    await this.sendClerkInvite(prepared.clerkOrgId, prepared.user.email, prepared.clerkRole, inviterClerkUserId);
    return prepared.user;
  }

  async resendInvite(tenantId: string, userId: string, inviterClerkUserId?: string): Promise<UserSummary> {
    const prepared = await this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId },
        include: { role: true },
      });
      if (!current) throw new NotFoundException('user not found');
      if (current.status !== 'INVITED') {
        throw new BadRequestException('Only pending invitations can be resent');
      }
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { clerkOrgId: true },
      });
      return {
        user: toSummary(current),
        clerkOrgId: tenant?.clerkOrgId ?? null,
        clerkRole: current.role.name === 'Admin' ? ('org:admin' as const) : ('org:member' as const),
      };
    });

    await this.sendClerkInvite(prepared.clerkOrgId, prepared.user.email, prepared.clerkRole, inviterClerkUserId);
    return prepared.user;
  }

  private async sendClerkInvite(
    clerkOrgId: string | null,
    email: string,
    role: 'org:member' | 'org:admin',
    inviterUserId?: string,
  ): Promise<void> {
    if (!clerkOrgId) return;
    const clerkInviterId =
      inviterUserId && !inviterUserId.startsWith('invite_') ? inviterUserId : undefined;
    try {
      await this.orgInviter.inviteMember({
        clerkOrgId,
        email,
        role,
        ...(clerkInviterId ? { inviterUserId: clerkInviterId } : {}),
      });
    } catch {
      throw new BadGatewayException(
        'Could not send the Clerk organization invitation. Check the email and try again.',
      );
    }
  }

  async update(tenantId: string, userId: string, input: UpdateUserInput): Promise<UserSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId },
        include: { role: true },
      });
      if (!current) throw new NotFoundException('user not found');

      if (input.roleId && input.roleId !== current.roleId) {
        const role = await tx.role.findUnique({ where: { id: input.roleId } });
        if (!role || role.tenantId !== tenantId) {
          throw new NotFoundException('role not found');
        }
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.UserRoleChanged, {
          userId,
          fromRoleId: current.roleId,
          toRoleId: input.roleId,
        });
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.roleId !== undefined) data.roleId = input.roleId;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.status !== undefined) data.status = input.status;

      const updated = await tx.user.update({
        where: { id: userId },
        data,
        include: { role: true },
      });
      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        roleName: updated.role.name,
        roleId: updated.role.id,
        status: updated.status,
        createdAt: updated.createdAt,
      };
    });
  }

  async deactivate(tenantId: string, userId: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId } });
      if (!current) throw new NotFoundException('user not found');
      if (current.status === 'SUSPENDED') return;
      await tx.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.UserDeactivated, { userId });
    });
  }

  async reactivate(tenantId: string, userId: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId } });
      if (!current) throw new NotFoundException('user not found');
      if (current.status === 'ACTIVE') return;
      await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    });
  }
}

function toSummary(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: Date;
  roleId: string;
  role: { id: string; name: string };
}): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleName: user.role.name,
    roleId: user.role.id,
    status: user.status,
    createdAt: user.createdAt,
  };
}