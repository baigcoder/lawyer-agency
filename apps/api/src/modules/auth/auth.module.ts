import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ClerkVerifier } from './infrastructure/clerk.verifier';
import {
  ClerkOrganizationInviter,
  NoopOrganizationInviter,
} from './infrastructure/clerk.organization-inviter';
import { AuthService } from './application/auth.service';
import { ORGANIZATION_INVITER, TOKEN_VERIFIER } from './application/auth.ports';
import { AuthController } from './interface/auth.controller';

/**
 * Auth module (Phase 10, D-017 / D-116). Provides Clerk JWT verification,
 * local RBAC resolution, and Clerk organization invitations. The TokenVerifier
 * / OrganizationInviter implementations are chosen at runtime: Clerk adapters
 * when CLERK_SECRET_KEY is set, otherwise the AuthGuard dev seam + a no-op
 * inviter.
 *
 * Global so guards/decorators in common/auth can resolve AuthService without
 * every module explicitly importing AuthModule.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: TOKEN_VERIFIER,
      useFactory: (config: ConfigService<Env, true>) => {
        const secretKey = config.get('CLERK_SECRET_KEY', { infer: true });
        return secretKey ? new ClerkVerifier(config) : null;
      },
      inject: [ConfigService],
    },
    {
      provide: ORGANIZATION_INVITER,
      useFactory: (config: ConfigService<Env, true>) => {
        const secretKey = config.get('CLERK_SECRET_KEY', { infer: true });
        const appPublicUrl = config.get('APP_PUBLIC_URL', { infer: true });
        return secretKey
          ? new ClerkOrganizationInviter(secretKey, appPublicUrl)
          : new NoopOrganizationInviter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, TOKEN_VERIFIER, ORGANIZATION_INVITER],
})
export class AuthModule {}
