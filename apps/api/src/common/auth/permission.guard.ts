import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from './require-permission.decorator';

/**
 * RBAC guard (Phase 10, D-017). Reads permission requirements from route/class
 * metadata and checks them against the principal attached by AuthGuard.
 *
 * In dev seam mode (no Clerk keys) the principal has no permissions list, so
 * the guard allows access. This preserves the existing local development/test
 * workflow; production always runs with Clerk and therefore real permissions.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const permissions = req.principal?.permissions;

    // Dev seam: no permission list means access is permitted (defense relies on
    // AuthGuard's tenant validation).
    if (!permissions) return true;

    if (permissions.includes('*')) return true;
    if (required.some((p) => permissions.includes(p))) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
