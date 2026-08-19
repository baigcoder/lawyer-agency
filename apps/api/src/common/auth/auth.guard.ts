import {
  CanActivate,
  Inject,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env';
import { AuthService } from '../../modules/auth/application/auth.service';
import { TOKEN_VERIFIER, type TokenVerifier } from '../../modules/auth/application/auth.ports';
import { RequestContextStore, type RequestContext } from '../context/request-context';

const UUID_LIKE = /^[0-9a-fA-F-]{36}$/;
const BEARER = /^Bearer\s+(.+)$/i;

export interface RequestPrincipal {
  tenantId: string;
  userId?: string | undefined;
  roleCode?: string | undefined;
  permissions?: string[] | undefined;
  name?: string | undefined;
  email?: string | null | undefined;
  isOwner?: boolean | undefined;
  clerkUserId?: string | undefined;
}

declare module 'express' {
  interface Request {
    principal?: RequestPrincipal;
  }
}

/**
 * Authentication guard (Phase 10, D-017). Operates in one of two modes:
 *
 * 1. Production/Clerk mode: when `CLERK_SECRET_KEY` is configured, verifies the
 *    `Authorization: Bearer <jwt>` token, resolves the Clerk organization to a
 *    local tenant, and loads the user's role/permissions.
 * 2. Dev seam: when Clerk keys are absent, reads `x-tenant-id` and optionally
 *    `x-user-id` headers. This keeps local integration tests and dashboard
 *    development working without a live Clerk tenant.
 *
 * The guard writes tenant/user context into the request-scoped store so every
 * downstream layer (decorators, UnitOfWork, services) sees the same identity.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly authService: AuthService,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const clerkEnabled = Boolean(this.config.get('CLERK_SECRET_KEY', { infer: true }));

    const principal = clerkEnabled
      ? await this.resolveClerkPrincipal(req)
      : this.resolveDevPrincipal(req);

    req.principal = principal;
    const contextPatch: Partial<RequestContext> = { tenantId: principal.tenantId };
    if (principal.userId) contextPatch.userId = principal.userId;
    RequestContextStore.set(contextPatch);
    return true;
  }

  private async resolveClerkPrincipal(req: Request): Promise<RequestPrincipal> {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    if (!match?.[1]) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = await this.verifier.verify(match[1]);
    const principal = await this.authService.resolvePrincipal(token);
    return {
      tenantId: principal.tenantId,
      userId: principal.userId,
      roleCode: principal.role.name,
      permissions: principal.permissions,
      name: principal.name,
      email: principal.email,
      isOwner: principal.permissions.includes('*') || principal.role.name === 'Admin',
      clerkUserId: principal.clerkUserId,
    };
  }

  private resolveDevPrincipal(req: Request): RequestPrincipal {
    const tenantHeader = req.headers['x-tenant-id'];
    if (typeof tenantHeader !== 'string' || !UUID_LIKE.test(tenantHeader)) {
      throw new UnauthorizedException(
        'Development mode: provide an x-tenant-id (uuid) header',
      );
    }
    const userHeader = req.headers['x-user-id'];
    const principal: RequestPrincipal = {
      tenantId: tenantHeader,
      roleCode: 'Admin',
      permissions: ['*'],
      name: 'Development owner',
      email: null,
      isOwner: true,
    };
    if (typeof userHeader === 'string' && UUID_LIKE.test(userHeader)) {
      principal.userId = userHeader;
    }
    return principal;
  }
}
