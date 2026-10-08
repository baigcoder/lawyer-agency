import { Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import type { OrganizationInviter, OrganizationInviteResult } from '../application/auth.ports';

/**
 * Sends a Clerk organization invitation so the invitee gets an email from
 * Clerk (no SMTP required) and joins the firm org. Local User rows remain the
 * RBAC source; Clerk membership is only the authN gate (D-116).
 *
 * Pending duplicates are revoked and re-created so "Resend invite" emails again.
 * Someone who already joined is reported as such — their membership used to be
 * deleted so a fresh email could go out, which signed a working colleague out
 * of the firm on every resend.
 */
export class ClerkOrganizationInviter implements OrganizationInviter {
  readonly invitationsEnabled = true;
  private readonly logger = new Logger(ClerkOrganizationInviter.name);

  constructor(
    private readonly secretKey: string,
    private readonly appPublicUrl: string,
  ) {}

  async inviteMember(input: {
    clerkOrgId: string;
    email: string;
    name: string;
    role: 'org:member' | 'org:admin';
    roleLabel: string;
    inviterUserId?: string;
  }): Promise<OrganizationInviteResult> {
    const clerk = createClerkClient({ secretKey: this.secretKey });
    const email = input.email.trim().toLowerCase();

    const payload = this.toCreateParams({ ...input, email });
    try {
      await clerk.organizations.createOrganizationInvitation(payload);
    } catch (error) {
      if (isAlreadyOrganizationMember(error)) {
        this.logger.log({ email, clerkOrgId: input.clerkOrgId }, 'Invitee already in org — no email needed');
        return { emailDelivery: 'already_member' };
      }
      if (!isPendingInvitationConflict(error)) throw error;
      await this.revokePending(clerk, { ...input, email });
      await clerk.organizations.createOrganizationInvitation(payload);
    }

    this.logger.log(
      { clerkOrgId: input.clerkOrgId, email, roleLabel: input.roleLabel },
      'Clerk organization invitation emailed',
    );
    return { emailDelivery: 'sent' };
  }

  private toCreateParams(input: {
    clerkOrgId: string;
    email: string;
    role: 'org:member' | 'org:admin';
    inviterUserId?: string;
  }) {
    return {
      organizationId: input.clerkOrgId,
      emailAddress: input.email,
      role: input.role,
      redirectUrl: `${this.appPublicUrl.replace(/\/$/, '')}/sign-in`,
      ...(input.inviterUserId ? { inviterUserId: input.inviterUserId } : {}),
    };
  }

  async revokeInvitation(input: {
    clerkOrgId: string;
    email: string;
    inviterUserId?: string;
    protectedClerkUserIds: string[];
  }): Promise<void> {
    const clerk = createClerkClient({ secretKey: this.secretKey });
    await this.revokePending(clerk, input);
    // Accepted already: the membership is what grants access, so remove it.
    const userId = await this.findInvitee(clerk, input.email, input.protectedClerkUserIds);
    if (!userId) return;
    try {
      await clerk.organizations.deleteOrganizationMembership({ organizationId: input.clerkOrgId, userId });
      this.logger.log({ organizationId: input.clerkOrgId }, 'Removed accepted membership of a cancelled invite');
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async syncMemberRole(input: {
    clerkOrgId: string;
    role: 'org:member' | 'org:admin';
    clerkUserId?: string;
    email?: string;
    protectedClerkUserIds?: string[];
  }): Promise<void> {
    const clerk = createClerkClient({ secretKey: this.secretKey });
    const email = input.email?.trim().toLowerCase();
    // A pending invitation carries its own role: an Admin invite demoted
    // before acceptance would otherwise still join as org:admin.
    if (email) await this.retargetPending(clerk, input.clerkOrgId, email, input.role);
    const userId =
      input.clerkUserId ?? (email ? await this.findInvitee(clerk, email, input.protectedClerkUserIds ?? []) : null);
    if (!userId) return;
    try {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: input.clerkOrgId,
        userId,
        role: input.role,
      });
    } catch (error) {
      // Not a member of the org: there is no Clerk role to take away.
      if (!isNotFound(error)) throw error;
    }
  }

  /**
   * The Clerk account an invitation email belongs to. Clerk's email filter
   * also matches secondary addresses, so a plain lookup could pick another
   * colleague who merely lists that address — and remove or re-role them.
   * Only the account whose *primary* address it is counts, never one already
   * bound to another team member, and only when that is unambiguous.
   */
  private async findInvitee(
    clerk: ReturnType<typeof createClerkClient>,
    email: string,
    protectedClerkUserIds: string[],
  ): Promise<string | null> {
    const wanted = email.trim().toLowerCase();
    const { data } = await clerk.users.getUserList({ emailAddress: [wanted], limit: 10 });
    const matches = data.filter(
      (user) =>
        user.primaryEmailAddress?.emailAddress.toLowerCase() === wanted && !protectedClerkUserIds.includes(user.id),
    );
    return matches.length === 1 ? (matches[0]?.id ?? null) : null;
  }

  private async retargetPending(
    clerk: ReturnType<typeof createClerkClient>,
    clerkOrgId: string,
    email: string,
    role: 'org:member' | 'org:admin',
  ): Promise<void> {
    const { data } = await clerk.organizations.getOrganizationInvitationList({
      organizationId: clerkOrgId,
      status: ['pending'],
      limit: 100,
    });
    const match = data.find((invitation) => invitation.emailAddress.toLowerCase() === email);
    if (!match || match.role === role) return;
    await clerk.organizations.revokeOrganizationInvitation({ organizationId: clerkOrgId, invitationId: match.id });
    // Re-issued with the new role; Clerk emails a fresh link.
    await clerk.organizations.createOrganizationInvitation(this.toCreateParams({ clerkOrgId, email, role }));
  }

  private async revokePending(
    clerk: ReturnType<typeof createClerkClient>,
    input: { clerkOrgId: string; email: string; inviterUserId?: string },
  ): Promise<void> {
    const { data } = await clerk.organizations.getOrganizationInvitationList({
      organizationId: input.clerkOrgId,
      status: ['pending'],
      limit: 100,
    });
    const match = data.find(
      (invitation) => invitation.emailAddress.toLowerCase() === input.email.toLowerCase(),
    );
    if (!match) return;
    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: input.clerkOrgId,
      invitationId: match.id,
      ...(input.inviterUserId ? { requestingUserId: input.inviterUserId } : {}),
    });
  }
}

export class NoopOrganizationInviter implements OrganizationInviter {
  readonly invitationsEnabled = false;

  async inviteMember(): Promise<OrganizationInviteResult> {
    return { emailDelivery: 'skipped' };
  }

  async revokeInvitation(): Promise<void> {}

  async syncMemberRole(): Promise<void> {}
}

function isNotFound(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  return status === 404 || clerkErrorCodes(error).includes('resource_not_found');
}

export function isAlreadyOrganizationMember(error: unknown): boolean {
  const codes = clerkErrorCodes(error);
  if (codes.includes('already_a_member_in_organization')) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /already a member in organization|already a member/.test(message);
}

export function isPendingInvitationConflict(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  const codes = clerkErrorCodes(error);
  if (codes.includes('duplicate_record')) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (status === 409) return true;
  return /already exists|pending invitation/.test(message);
}

export function clerkErrorMessage(error: unknown): string {
  const codes = clerkErrorCodes(error);
  if (codes.length > 0) return codes.join(', ');
  if (error instanceof Error) return error.message;
  return String(error);
}

function clerkErrorCodes(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('errors' in error)) return [];
  const errors = (error as { errors: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('code' in entry)) return [];
    return typeof entry.code === 'string' ? [entry.code] : [];
  });
}
