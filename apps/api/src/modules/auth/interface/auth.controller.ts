import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';

export interface AuthSessionDto {
  userId: string | null;
  tenantId: string;
  name: string;
  email: string | null;
  role: string;
  permissions: string[];
  isOwner: boolean;
}

/**
 * Session introspection for the dashboard (D-116). AuthGuard already resolved
 * the principal; this endpoint returns a UI-safe snapshot for nav + route
 * guards. No extra permission is required — every authenticated firm member
 * may read their own session.
 */
@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  @Get('me')
  me(@CurrentUser() principal: RequestPrincipal): AuthSessionDto {
    const permissions = principal.permissions ?? ['*'];
    const role = principal.roleCode ?? 'Admin';
    return {
      userId: principal.userId ?? null,
      tenantId: principal.tenantId,
      name: principal.name ?? 'Account',
      email: principal.email ?? null,
      role,
      permissions,
      isOwner: permissions.includes('*') || role === 'Admin',
    };
  }
}
