import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthGuard } from '../../common/auth/auth.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { AuthService } from './application/auth.service';
import { RequestContextStore } from '../../common/context/request-context';

function mockContext(req: Partial<Request> & { headers?: Record<string, string | undefined> }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req as Request,
    }),
    getHandler: () => (() => {}),
    getClass: () => class {},
  } as ExecutionContext;
}

function mockConfig(env: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

describe('AuthGuard', () => {
  it('dev seam accepts x-tenant-id header', async () => {
    const guard = new AuthGuard(
      mockConfig({}),
      undefined as unknown as AuthService,
      undefined as unknown as symbol,
    );

    await RequestContextStore.run({ correlationId: 'c1' }, async () => {
      const result = await guard.canActivate(
        mockContext({ headers: { 'x-tenant-id': '11111111-1111-1111-1111-111111111111' } }),
      );
      expect(result).toBe(true);
      expect(RequestContextStore.tenantId()).toBe('11111111-1111-1111-1111-111111111111');
    });
  });

  it('dev seam rejects missing x-tenant-id', async () => {
    const guard = new AuthGuard(
      mockConfig({}),
      undefined as unknown as AuthService,
      undefined as unknown as symbol,
    );

    await expect(guard.canActivate(mockContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('development clerk mode falls back to x-tenant-id without a Bearer token', async () => {
    const verifier = { verify: vi.fn() };
    const guard = new AuthGuard(
      mockConfig({ CLERK_SECRET_KEY: 'sk_test_example', NODE_ENV: 'development' }),
      undefined as unknown as AuthService,
      verifier as unknown as symbol,
    );

    await RequestContextStore.run({ correlationId: 'c1' }, async () => {
      const result = await guard.canActivate(
        mockContext({ headers: { 'x-tenant-id': '11111111-1111-1111-1111-111111111111' } }),
      );
      expect(result).toBe(true);
      expect(verifier.verify).not.toHaveBeenCalled();
      expect(RequestContextStore.tenantId()).toBe('11111111-1111-1111-1111-111111111111');
    });
  });

  it('production clerk mode rejects missing Authorization even with x-tenant-id', async () => {
    const guard = new AuthGuard(
      mockConfig({ CLERK_SECRET_KEY: 'sk_test_example', NODE_ENV: 'production' }),
      undefined as unknown as AuthService,
      undefined as unknown as symbol,
    );

    await expect(
      guard.canActivate(
        mockContext({
          headers: {
            'x-tenant-id': '11111111-1111-1111-1111-111111111111',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clerk mode verifies token and resolves principal', async () => {
    const verifier = {
      verify: vi.fn(async () => ({
        clerkUserId: 'user_clerk',
        clerkOrgId: 'org_1',
        email: 'a@firm.com',
        name: 'A',
      })),
    };
    const authService = {
      resolvePrincipal: vi.fn(async () => ({
        tenantId: 'tenant-1',
        userId: 'user-1',
        clerkUserId: 'user_clerk',
        role: { id: 'role-1', name: 'Admin', isSystem: true },
        permissions: ['*'],
      })),
    };
    const guard = new AuthGuard(
      mockConfig({ CLERK_SECRET_KEY: 'sk_test_example' }),
      authService as unknown as AuthService,
      verifier as unknown as symbol,
    );

    await RequestContextStore.run({ correlationId: 'c1' }, async () => {
      const req = { headers: { authorization: 'Bearer clerk-jwt' } } as unknown as Request;
      const result = await guard.canActivate(mockContext(req));
      expect(result).toBe(true);
      expect(verifier.verify).toHaveBeenCalledWith('clerk-jwt');
      expect(authService.resolvePrincipal).toHaveBeenCalled();
      expect(RequestContextStore.tenantId()).toBe('tenant-1');
    });
  });
});

describe('PermissionGuard', () => {
  it('allows access when no permissions are required', () => {
    const reflector = { getAllAndOverride: vi.fn(() => undefined) };
    const guard = new PermissionGuard(reflector as never);
    expect(guard.canActivate(mockContext({}) as ExecutionContext)).toBe(true);
  });

  it('allows access when principal has required permission', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['cases:read']) };
    const guard = new PermissionGuard(reflector as never);
    const ctx = mockContext({
      principal: { tenantId: 't1', userId: 'u1', permissions: ['cases:read', 'cases:write'] },
    } as unknown as Request);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
  });

  it('allows access with wildcard permission', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['admin']) };
    const guard = new PermissionGuard(reflector as never);
    const ctx = mockContext({
      principal: { tenantId: 't1', permissions: ['*'] },
    } as unknown as Request);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
  });

  it('throws ForbiddenException when permission is missing', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['cases:write']) };
    const guard = new PermissionGuard(reflector as never);
    const ctx = mockContext({
      principal: { tenantId: 't1', permissions: ['cases:read'] },
    } as unknown as Request);
    expect(() => guard.canActivate(ctx as ExecutionContext)).toThrow(ForbiddenException);
  });

  it('dev seam allows access because no permission list exists', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['cases:write']) };
    const guard = new PermissionGuard(reflector as never);
    const ctx = mockContext({ principal: { tenantId: 't1' } } as unknown as Request);
    expect(guard.canActivate(ctx as ExecutionContext)).toBe(true);
  });
});

describe('@RequirePermission', () => {
  it('sets metadata on a class', () => {
    @RequirePermission('cases:read')
    class TestController {}
    expect(Reflect.getMetadata('required_permissions', TestController)).toEqual(['cases:read']);
  });
});
