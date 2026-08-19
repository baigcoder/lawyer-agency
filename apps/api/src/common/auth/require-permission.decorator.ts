import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Mark a route or controller as requiring one or more permissions. The
 * PermissionGuard grants access if the principal has ANY of the listed
 * permissions (OR semantics). Use `['*']` for super-admin access.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
