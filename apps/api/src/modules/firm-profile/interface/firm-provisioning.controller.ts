import { Body, Controller, ForbiddenException, Get, Headers, Inject, Put, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TOKEN_VERIFIER, type TokenVerifier, type VerifiedToken } from '../../auth/application/auth.ports';
import { isClerkOrgAdmin } from '../../auth/application/clerk-claims';
import { provisionFirmSchema, type ProvisionFirmInput } from '../application/dto';
import { FirmProvisioningService } from '../application/firm-provisioning.service';

const UUID_LIKE = /^[0-9a-fA-F-]{36}$/;

type ProvisioningIdentity =
  | (VerifiedToken & { clerkOrgId: string })
  | { devSeam: true; tenantId: string };

@Controller('firm-provisioning')
export class FirmProvisioningController {
  constructor(
    private readonly provisioning: FirmProvisioningService,
    private readonly config: ConfigService<Env, true>,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier | null,
  ) {}

  private async resolveIdentity(
    authorization: string | undefined,
    tenantIdHeader: string | undefined,
  ): Promise<ProvisioningIdentity> {
    const clerkEnabled = Boolean(this.config.get('CLERK_SECRET_KEY', { infer: true }));

    if (!clerkEnabled) {
      // Dev seam (D-037): the dashboard sends x-tenant-id when Clerk is off.
      if (typeof tenantIdHeader !== 'string' || !UUID_LIKE.test(tenantIdHeader)) {
        throw new UnauthorizedException('Development mode: provide an x-tenant-id (uuid) header');
      }
      return { devSeam: true, tenantId: tenantIdHeader };
    }

    if (!this.verifier) {
      throw new UnauthorizedException('Firm provisioning requires Clerk authentication');
    }
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Missing authorization token');
    const identity = await this.verifier.verify(token);
    return identity as VerifiedToken & { clerkOrgId: string };
  }

  @Put()
  async provision(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-tenant-id') tenantIdHeader: string | undefined,
    @Body(new ZodValidationPipe(provisionFirmSchema)) body: ProvisionFirmInput,
  ) {
    const identity = await this.resolveIdentity(authorization, tenantIdHeader);

    if ('devSeam' in identity) {
      return this.provisioning.provisionDev(identity.tenantId, body);
    }

    if (!identity.clerkOrgId) {
      throw new UnauthorizedException('Create or select a Clerk organization first');
    }
    if (identity.clerkOrgRole && !isClerkOrgAdmin(identity.clerkOrgRole)) {
      throw new ForbiddenException('Only the firm owner can complete setup');
    }

    return this.provisioning.provision({
      ...body,
      clerkOrgId: identity.clerkOrgId,
      clerkUserId: identity.clerkUserId,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
  }

  /** Lets the dashboard decide between /onboarding and /dashboard without a
   *  tenant context — resolves the org mapping only (D-093). */
  @Get('status')
  async status(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-tenant-id') tenantIdHeader: string | undefined,
  ) {
    const identity = await this.resolveIdentity(authorization, tenantIdHeader);

    if ('devSeam' in identity) {
      return this.provisioning.statusByTenantId(identity.tenantId);
    }

    if (!identity.clerkOrgId) {
      // Signed in but no org selected — treat as unprovisioned so the
      // dashboard redirects to /onboarding instead of a 401 error screen.
      return { provisioned: false, tenantId: null };
    }

    return this.provisioning.status(identity.clerkOrgId);
  }
}
