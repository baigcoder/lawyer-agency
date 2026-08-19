import { createClerkClient } from '@clerk/backend';
import type { OrganizationInviter } from '../application/auth.ports';

/**
 * Sends a Clerk organization invitation so the invitee joins the same org
 * as the firm (required for JWT `o.id` / org context). Local User rows
 * remain the source of RBAC; Clerk membership is only the authN gate.
 *
 * Team-page invites are the only supported path (D-116). A pending duplicate
 * is revoked and re-created so "Resend invite" actually emails again.
 * Already-member conflicts are treated as success (they only need to sign in).
 */
export class ClerkOrganizationInviter implements OrganizationInviter {
  constructor(
    private readonly secretKey: string,
    private readonly appPublicUrl: string,
  ) {}

  async inviteMember(input: {
    clerkOrgId: string;
    email: string;
    role: 'org:member' | 'org:admin';
    inviterUserId?: string;
  }): Promise<void> {
    const clerk = createClerkClient({ secretKey: this.secretKey });
    const payload = this.toCreateParams(input);
    try {
      await clerk.organizations.createOrganizationInvitation(payload);
    } catch (error) {
      if (isAlreadyOrganizationMember(error)) return;
      if (!isPendingInvitationConflict(error)) throw error;
      await this.revokePendingInvitation(clerk, input);
      await clerk.organizations.createOrganizationInvitation(payload);
    }
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
  async inviteMember(): Promise<void> {
    return;
  }
}

function isAlreadyOrganizationMember(error: unknown): boolean {
  const codes = clerkErrorCodes(error);
  if (codes.includes('already_a_member_in_organization')) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /already a member in organization|already a member/.test(message);
}

function isPendingInvitationConflict(error: unknown): boolean {
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

function clerkErrorCodes(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('errors' in error)) return [];
  const errors = (error as { errors: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('code' in entry)) return [];
    return typeof entry.code === 'string' ? [entry.code] : [];
  });
}
