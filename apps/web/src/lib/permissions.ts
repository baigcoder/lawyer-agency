export function hasPermission(permissions: readonly string[] | undefined, required: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  required: readonly string[],
): boolean {
  return required.some((code) => hasPermission(permissions, code));
}

/**
 * Longest-prefix route rules for the dashboard. Owner (Admin `*`) passes every
 * check; lawyers only get operational surfaces they are invited for (D-116).
 */
export const DASHBOARD_ROUTE_RULES: Array<{ prefix: string; anyOf: string[] }> = [
  { prefix: '/dashboard/inbox', anyOf: ['inbox:read'] },
  { prefix: '/dashboard/escalations', anyOf: ['inbox:read'] },
  { prefix: '/dashboard/cases', anyOf: ['cases:read'] },
  { prefix: '/dashboard/documents', anyOf: ['cases:write'] },
  { prefix: '/dashboard/knowledge', anyOf: ['knowledge-base:read'] },
  { prefix: '/dashboard/calendar', anyOf: ['appointments:read'] },
  { prefix: '/dashboard/team', anyOf: ['users:read'] },
  { prefix: '/dashboard/whatsapp', anyOf: ['whatsapp:read'] },
  { prefix: '/dashboard/payments', anyOf: ['payments:read'] },
  { prefix: '/dashboard/analytics', anyOf: ['analytics:read'] },
  { prefix: '/dashboard/settings', anyOf: ['users:manage', 'lawyers:write', 'notifications:write'] },
  { prefix: '/dashboard/setup', anyOf: ['users:manage'] },
  { prefix: '/dashboard', anyOf: ['firm-profile:read'] },
];

export function requiredPermissionsForPath(pathname: string): string[] | null {
  const ranked = [...DASHBOARD_ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = ranked.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
  return match?.anyOf ?? null;
}
