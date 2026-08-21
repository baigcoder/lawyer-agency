import { describe, expect, it } from 'vitest';
import {
  isAlreadyOrganizationMember,
  isPendingInvitationConflict,
} from './clerk.organization-inviter';

describe('isAlreadyOrganizationMember', () => {
  it('detects Clerk already-member error codes', () => {
    expect(
      isAlreadyOrganizationMember({
        errors: [{ code: 'already_a_member_in_organization' }],
      }),
    ).toBe(true);
  });

  it('detects message text fallback', () => {
    expect(isAlreadyOrganizationMember(new Error('User is already a member in organization'))).toBe(true);
    expect(isAlreadyOrganizationMember(new Error('unrelated'))).toBe(false);
  });
});

describe('isPendingInvitationConflict', () => {
  it('detects duplicate pending invitation', () => {
    expect(isPendingInvitationConflict({ status: 409, errors: [{ code: 'duplicate_record' }] })).toBe(true);
    expect(isPendingInvitationConflict(new Error('pending invitation already exists'))).toBe(true);
    expect(isPendingInvitationConflict(new Error('unrelated'))).toBe(false);
  });
});
