/**
 * Pure parsers for Clerk session-token organization claims (D-017 / D-116).
 * Compact v2 tokens put org data on `o: { id, rol, slg }`; older tokens use
 * flat `org_id` / `org_role`. Kept vendor-free so AuthService can reason
 * about owner vs member without importing `@clerk/backend`.
 */

export function isClerkOrgAdmin(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'org:admin' || normalized.endsWith(':admin');
}

export function extractOrgClaims(payload: {
  o?: unknown;
  org_id?: unknown;
  org_role?: unknown;
}): { orgId: string | null; orgRole: string | null } {
  const compact = asRecord(payload.o);
  return {
    orgId: asNonEmptyString(compact?.id ?? payload.org_id),
    orgRole: asNonEmptyString(compact?.rol ?? payload.org_role),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}
