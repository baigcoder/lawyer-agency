import { describe, expect, it } from 'vitest';
import { extractOrgClaims, isClerkOrgAdmin } from './clerk-claims';

describe('isClerkOrgAdmin', () => {
  it('accepts compact and legacy admin role keys', () => {
    expect(isClerkOrgAdmin('admin')).toBe(true);
    expect(isClerkOrgAdmin('org:admin')).toBe(true);
    expect(isClerkOrgAdmin('ORG:ADMIN')).toBe(true);
  });

  it('rejects members and empty values', () => {
    expect(isClerkOrgAdmin('member')).toBe(false);
    expect(isClerkOrgAdmin('org:member')).toBe(false);
    expect(isClerkOrgAdmin(null)).toBe(false);
    expect(isClerkOrgAdmin(undefined)).toBe(false);
    expect(isClerkOrgAdmin('')).toBe(false);
  });
});

describe('extractOrgClaims', () => {
  it('reads compact v2 organization claims', () => {
    expect(extractOrgClaims({ o: { id: 'org_1', rol: 'admin', slg: 'firm' } })).toEqual({
      orgId: 'org_1',
      orgRole: 'admin',
    });
  });

  it('falls back to legacy flat claims', () => {
    expect(extractOrgClaims({ org_id: 'org_2', org_role: 'org:member' })).toEqual({
      orgId: 'org_2',
      orgRole: 'org:member',
    });
  });

  it('returns nulls when organization context is missing', () => {
    expect(extractOrgClaims({})).toEqual({ orgId: null, orgRole: null });
  });
});
