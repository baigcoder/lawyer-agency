import { Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import type { OrganizationInviter, OrganizationInviteResult } from '../application/auth.ports';

/**
 * Sends a Clerk organization invitation so the invitee gets an email from
 * Clerk (no SMTP required) and joins the firm org. Local User rows remain the
 * RBAC source; Clerk membership is only the authN gate (D-116).
 *
 * Pending duplicates are revoked and re-created so "Resend invite" emails again.
 * If a prior credentials-invite path already added them as a member without
 * emailing, membership is removed so a fresh invite email can be sent.
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
    await this.dropStaleMembership(clerk, input.clerkOrgId, email);

    const payload = this.toCreateParams({ ...input, email });
    try {
      await clerk.organizations.createOrganizationInvitation(payload);
    } catch (error) {
      if (isAlreadyOrganizationMember(error)) {
        this.logger.log({ email, clerkOrgId: input.clerkOrgId }, 'Invitee already in org — no email needed');
        return { emailDelivery: 'sent' };
      }
      if (!isPendingInvitationConflict(error)) throw error;
      await this.revokePendingInvitation(clerk, { ...input, email });
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

  private async dropStaleMembership(
    clerk: ReturnType<typeof createClerkClient>,
    organizationId: string,
    email: string,
  ): Promise<void> {
    const { data } = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    const user = data[0];
    if (!user) return;
    try {
      await clerk.organizations.deleteOrganizationMembership({
        organizationId,
        userId: user.id,
      });
      this.logger.log({ email, organizationId }, 'Removed stale org membership before invite email');
    } catch {
      // Not a member — nothing to clear.
    }
  }

  private async revokePendingInvitation(
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
