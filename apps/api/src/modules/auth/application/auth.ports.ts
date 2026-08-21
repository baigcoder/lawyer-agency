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
  /** Clerk emails the invitee; 'skipped' only in the local no-Clerk path. */
  emailDelivery: 'sent' | 'skipped';
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
}

export const ORGANIZATION_INVITER = Symbol('ORGANIZATION_INVITER');
