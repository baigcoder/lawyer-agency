import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestPrincipal } from './auth.guard';

/**
 * Handler parameter that resolves the authenticated principal set by
 * AuthGuard. Returns the full principal object; use destructuring to pick
 * tenantId/userId/roleCode/permissions.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx): RequestPrincipal => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const principal = req.principal;
    if (!principal) {
      throw new Error('CurrentUser used without AuthGuard');
    }
    return principal;
  },
);
