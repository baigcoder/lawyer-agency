/**
 * Authentication ports (Phase 10). Keeps the Clerk dependency in
 * infrastructure; the rest of the app depends only on these abstractions.
 */

export interface VerifiedToken {
  /** Clerk user id (sub claim). */
  clerkUserId: string;
  /** Clerk organization id (org_id / compact `o.id` claim) when present. */
  clerkOrgId?: string | null;
  /** Clerk organization role (`org:admin` / compact `o.rol`) when present. */
  clerkOrgRole?: string | null;
  /** Primary email when available. */
  email?: string | null;
  /** Display name when available. */
  name?: string | null;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface OrganizationInviteResult {
  /**
   * Clerk emails the invitee; 'skipped' only in the local no-Clerk path;
   * 'already_member' when they already joined the org and only need to sign in.
   */
  emailDelivery: 'sent' | 'skipped' | 'already_member';
}

export interface OrganizationInviter {
  /** False in the local no-Clerk / Noop path — invites are local rows only. */
  readonly invitationsEnabled: boolean;
  inviteMember(input: {
    clerkOrgId: string;
    email: string;
    name: string;
    role: 'org:member' | 'org:admin';
    roleLabel: string;
    inviterUserId?: string;
  }): Promise<OrganizationInviteResult>;
  /**
   * Withdraw an invitation completely: revoke it if still pending, and remove
   * the org membership if it was already accepted. Leaving an accepted
   * membership behind let a cancelled Admin invitee sign in later and be
   * auto-provisioned as Admin.
   */
  revokeInvitation(input: {
    clerkOrgId: string;
    email: string;
    inviterUserId?: string;
    /** Clerk users that belong to other team members: never touched by an email lookup. */
    protectedClerkUserIds: string[];
  }): Promise<void>;
  /**
   * Mirror the local role onto the Clerk org membership. Clerk org admins can
   * invite people (who then auto-provision as Admin) from Clerk's own UI, so a
   * demoted or suspended Admin must lose org:admin there too.
   */
  syncMemberRole(input: {
    clerkOrgId: string;
    role: 'org:member' | 'org:admin';
    /** Known once they have signed in. */
    clerkUserId?: string;
    /** For an invitee not yet signed in: their pending invitation and, if accepted, their membership. */
    email?: string;
    protectedClerkUserIds?: string[];
  }): Promise<void>;
}

export const ORGANIZATION_INVITER = Symbol('ORGANIZATION_INVITER');
