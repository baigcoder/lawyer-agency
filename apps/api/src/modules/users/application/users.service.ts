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

/** Returned after invite/resend — never includes credentials (emailed by Clerk). */
export interface InviteUserResult extends UserSummary {
  emailDelivery: 'sent' | 'skipped';
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
  ): Promise<InviteUserResult> {
    const email = normalizeEmail(input.email);
    const prepared = await this.uow.withTenant(tenantId, async (tx) => {
      await this.auth.seedSystemRoles(tx, tenantId);

      const role = await tx.role.findUnique({ where: { id: input.roleId } });
      if (!role || role.tenantId !== tenantId) {
        throw new NotFoundException('role not found');
      }

      const duplicate = await tx.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { role: true },
      });
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { clerkOrgId: true, name: true },
      });
      const clerkRole = role.name === 'Admin' ? ('org:admin' as const) : ('org:member' as const);

      if (duplicate) {
        if (duplicate.status === 'INVITED') {
          return {
            user: toSummary(duplicate),
            userId: duplicate.id,
            clerkOrgId: tenant?.clerkOrgId ?? null,
            clerkRole,
            roleLabel: role.name,
            name: input.name.trim() || duplicate.name,
          };
        }
        throw new ConflictException('A user with this email is already on the team');
      }

      const created = await tx.user.create({
        data: {
          tenantId,
          clerkUserId: input.clerkUserId ?? `invite_${randomUUID()}`,
          roleId: input.roleId,
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || null,
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
        userId: created.id,
        clerkOrgId: tenant?.clerkOrgId ?? null,
        clerkRole,
        roleLabel: role.name,
        name: created.name,
      };
    });

    const invite = await this.sendClerkInvite({
      clerkOrgId: prepared.clerkOrgId,
      email: prepared.user.email,
      name: prepared.name,
      role: prepared.clerkRole,
      roleLabel: prepared.roleLabel,
      ...(inviterClerkUserId ? { inviterUserId: inviterClerkUserId } : {}),
    });

    return {
      ...prepared.user,
      emailDelivery: invite.emailDelivery,
    };
  }

  async resendInvite(tenantId: string, userId: string, inviterClerkUserId?: string): Promise<InviteUserResult> {
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
        userId: current.id,
        clerkOrgId: tenant?.clerkOrgId ?? null,
        clerkRole: current.role.name === 'Admin' ? ('org:admin' as const) : ('org:member' as const),
        roleLabel: current.role.name,
        name: current.name,
      };
    });

    const invite = await this.sendClerkInvite({
      clerkOrgId: prepared.clerkOrgId,
      email: prepared.user.email,
      name: prepared.name,
      role: prepared.clerkRole,
      roleLabel: prepared.roleLabel,
      ...(inviterClerkUserId ? { inviterUserId: inviterClerkUserId } : {}),
    });

    return {
      ...prepared.user,
      emailDelivery: invite.emailDelivery,
    };
  }

  private async sendClerkInvite(input: {
    clerkOrgId: string | null;
    email: string;
    name: string;
    role: 'org:member' | 'org:admin';
    roleLabel: string;
    inviterUserId?: string;
  }): Promise<{ emailDelivery: 'sent' | 'skipped' }> {
    if (!this.orgInviter.invitationsEnabled) {
      return this.orgInviter.inviteMember({
        clerkOrgId: input.clerkOrgId ?? 'dev-org',
        email: input.email,
        name: input.name,
        role: input.role,
        roleLabel: input.roleLabel,
      });
    }
    if (!input.clerkOrgId) {
      throw new BadRequestException(
        'This firm is not linked to a Clerk organization, so invites cannot be emailed. Finish firm setup, then try again.',
      );
    }
    const clerkInviterId =
      input.inviterUserId && !input.inviterUserId.startsWith('invite_') ? input.inviterUserId : undefined;
    try {
      return await this.orgInviter.inviteMember({
        clerkOrgId: input.clerkOrgId,
        email: normalizeEmail(input.email),
        name: input.name,
        role: input.role,
        roleLabel: input.roleLabel,
        ...(clerkInviterId ? { inviterUserId: clerkInviterId } : {}),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Clerk invitation failed';
      throw new BadGatewayException(
        `Could not email the team invitation (${detail}). Check the email address and that Organizations are enabled in Clerk.`,
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
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
