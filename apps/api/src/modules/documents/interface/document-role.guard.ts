import { type CanActivate, type ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/** Matches system role names seeded by AuthService (Admin = owner, Lawyer = counsel). */
const ALLOWED_ROLES = new Set(['Admin', 'Lawyer']);

/**
 * Document RBAC: only firm admins and lawyers can upload or view internal
 * documents. Clients never see this endpoint. In dev seam mode (no roleCode on
 * principal) the guard is permissive so local development works.
 */
@Injectable()
export class DocumentRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const roleCode = req.principal?.roleCode;
    if (!roleCode) return true; // dev seam
    if (ALLOWED_ROLES.has(roleCode)) return true;
    throw new ForbiddenException('Document access requires Admin or Lawyer role');
  }
}
