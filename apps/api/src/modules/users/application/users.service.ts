import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { AuthService } from '../../auth/application/auth.service';
import {
  ORGANIZATION_INVITER,
  type OrganizationInviteResult,
  type OrganizationInviter,
} from '../../auth/application/auth.ports';
import type { Prisma } from '../../../generated/prisma/client';
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
  emailDelivery: OrganizationInviteResult['emailDelivery'];
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
  }): Promise<OrganizationInviteResult> {
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

  /**
   * Withdraws a pending invitation: the emailed link stops working and the row
   * leaves the team list. Before this the only option was "deactivate", which
   * left the Clerk invitation live: the invitee could still join, then hit an
   * unexplained "account not active" wall.
   */
  async cancelInvite(tenantId: string, userId: string, inviterClerkUserId?: string): Promise<void> {
    const pending = await this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId } });
      if (!current) throw new NotFoundException('user not found');
      if (current.status !== 'INVITED') {
        throw new BadRequestException('Only pending invitations can be cancelled');
      }
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { clerkOrgId: true } });
      return {
        email: current.email,
        clerkOrgId: tenant?.clerkOrgId ?? null,
        protectedClerkUserIds: await this.teamClerkUserIds(tx),
      };
    });

    // Revoke first: if Clerk is unreachable the row stays, so the owner can retry.
    if (this.orgInviter.invitationsEnabled && pending.clerkOrgId) {
      const clerkInviterId =
        inviterClerkUserId && !inviterClerkUserId.startsWith('invite_') ? inviterClerkUserId : undefined;
      try {
        await this.orgInviter.revokeInvitation({
          clerkOrgId: pending.clerkOrgId,
          email: pending.email,
          protectedClerkUserIds: pending.protectedClerkUserIds,
          ...(clerkInviterId ? { inviterUserId: clerkInviterId } : {}),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Clerk revoke failed';
        throw new BadGatewayException(`Could not withdraw the invitation (${detail}). Try again.`);
      }
    }

    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.user.deleteMany({ where: { id: userId, status: 'INVITED' } });
    });
  }

  async update(
    tenantId: string,
    userId: string,
    input: UpdateUserInput,
    actorUserId?: string,
  ): Promise<UserSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId },
        include: { role: true },
      });
      if (!current) throw new NotFoundException('user not found');
      if (input.status === 'SUSPENDED' && userId === actorUserId) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }

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

      const losesAdmin =
        (input.roleId !== undefined && input.roleId !== current.roleId) ||
        (input.status !== undefined && input.status !== 'ACTIVE');
      if (losesAdmin) await this.assertNotLastAdmin(tx, current);

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
      if (input.roleId !== undefined || input.status !== undefined) {
        await this.syncClerkRole(tx, tenantId, updated);
      }
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

  async deactivate(tenantId: string, userId: string, actorUserId?: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId }, include: { role: true } });
      if (!current) throw new NotFoundException('user not found');
      if (current.status === 'SUSPENDED') return;
      if (userId === actorUserId) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }
      await this.assertNotLastAdmin(tx, current);
      const suspended = await tx.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED' },
        include: { role: true },
      });
      await this.syncClerkRole(tx, tenantId, suspended);
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.UserDeactivated, { userId });
    });
  }

  /**
   * Clerk org admins can invite from Clerk's own UI, and an org admin with no
   * local row is auto-provisioned as Admin, so the Clerk role must follow the
   * local one: org:admin only while the user is an active Admin. Runs inside
   * the caller's transaction, so if Clerk refuses, the local change is rolled
   * back rather than leaving the two out of step.
   */
  private async syncClerkRole(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: { clerkUserId: string; email: string; status: string; role: { name: string } },
  ): Promise<void> {
    if (!this.orgInviter.invitationsEnabled) return;
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { clerkOrgId: true } });
    if (!tenant?.clerkOrgId) return;
    const clerkOrgId = tenant.clerkOrgId;
    const role = user.status === 'ACTIVE' && user.role.name === 'Admin' ? 'org:admin' : 'org:member';
    // Not signed in yet: no Clerk id to address, but the invitation (pending,
    // or accepted and waiting for first sign-in) already carries a role.
    const invitee = user.clerkUserId.startsWith('invite_');
    try {
      if (!invitee) {
        await this.orgInviter.syncMemberRole({ clerkOrgId, clerkUserId: user.clerkUserId, role });
      } else if (user.status === 'SUSPENDED') {
        await this.orgInviter.revokeInvitation({
          clerkOrgId,
          email: user.email,
          protectedClerkUserIds: await this.teamClerkUserIds(tx),
        });
      } else {
        await this.orgInviter.syncMemberRole({
          clerkOrgId,
          role,
          email: user.email,
          protectedClerkUserIds: await this.teamClerkUserIds(tx),
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Clerk update failed';
      throw new BadGatewayException(`Could not update their access in Clerk (${detail}). Nothing was changed; try again.`);
    }
  }

  /** Clerk accounts already bound to team members — an email lookup must never touch these. */
  private async teamClerkUserIds(tx: Prisma.TransactionClient): Promise<string[]> {
    const rows = await tx.user.findMany({ where: { status: { not: 'INVITED' } }, select: { clerkUserId: true } });
    return rows.map((r) => r.clerkUserId).filter((id) => !id.startsWith('invite_'));
  }

  /**
   * Every permission to manage the team sits with Admin, so suspending or
   * demoting the only active Admin locked the whole firm out of its own
   * settings, with no way back from the dashboard.
   */
  private async assertNotLastAdmin(
    tx: Prisma.TransactionClient,
    user: { id: string; status: string; role: { name: string } },
  ): Promise<void> {
    if (user.role.name !== 'Admin' || user.status !== 'ACTIVE') return;
    const otherAdmins = await tx.user.count({
      where: { id: { not: user.id }, status: 'ACTIVE', role: { name: 'Admin' } },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException('The firm needs at least one active Admin. Make someone else Admin first.');
    }
  }

  async reactivate(tenantId: string, userId: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId } });
      if (!current) throw new NotFoundException('user not found');
      if (current.status === 'ACTIVE') return;
      const active = await tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
        include: { role: true },
      });
      await this.syncClerkRole(tx, tenantId, active);
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
