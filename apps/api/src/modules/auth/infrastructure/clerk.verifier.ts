import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { Env } from '../../../config/env';
import type { TokenVerifier, VerifiedToken } from '../application/auth.ports';
import { extractOrgClaims } from '../application/clerk-claims';

const PROFILE_TTL_MS = 5 * 60_000;

/**
 * Clerk JWT verifier (D-017). Uses the official Clerk backend SDK so token
 * validation, issuer/audience checks, and JWKS rotation are handled
 * correctly. Keeps all Clerk-specific code in this file.
 *
 * Session tokens often omit email/name. Those are hydrated from the Clerk
 * Users API (cached) so invite-by-email matching works (D-116).
 */
@Injectable()
export class ClerkVerifier implements TokenVerifier {
  private readonly secretKey: string;
  private readonly profileCache = new Map<string, { email: string | null; name: string | null; expiresAt: number }>();

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('CLERK_SECRET_KEY', { infer: true });
    if (!secretKey) throw new Error('CLERK_SECRET_KEY is required when Clerk auth is enabled');
    this.secretKey = secretKey;
  }

  async verify(token: string): Promise<VerifiedToken> {
    // `jwtKey` accepts a PEM public key, not a JWKS URL. The Clerk server
    // secret lets the SDK fetch and rotate the matching JWK safely.
    let result: Awaited<ReturnType<typeof verifyToken>>;
    try {
      result = await verifyToken(token, { secretKey: this.secretKey });
    } catch {
      // Mismatched CLERK_SECRET_KEY vs browser session (common when Docker
      // was started from another checkout) must not surface as a 500.
      throw new UnauthorizedException('Clerk session could not be verified — sign out and back in, or align CLERK_SECRET_KEY with the web app');
    }
    if ('errors' in result) {
      // Clerk returns a result union for invalid credentials instead of
      // always throwing. Never turn that into a fabricated user identity.
      throw new UnauthorizedException('Unable to verify Clerk session');
    }
    const payload = result;
    const { orgId, orgRole } = extractOrgClaims(payload);
    const clerkUserId = String(payload.sub);
    const tokenEmail = payload.email ? String(payload.email) : null;
    const tokenName = payload.name ? String(payload.name) : null;
    const profile = await this.hydrateProfile(clerkUserId, tokenEmail, tokenName);

    return {
      clerkUserId,
      clerkOrgId: orgId,
      clerkOrgRole: orgRole,
      email: profile.email,
      name: profile.name,
    };
  }

  private async hydrateProfile(
    clerkUserId: string,
    email: string | null,
    name: string | null,
  ): Promise<{ email: string | null; name: string | null }> {
    if (email && name) return { email, name };

    const cached = this.profileCache.get(clerkUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return { email: email ?? cached.email, name: name ?? cached.name };
    }

    try {
      const clerk = createClerkClient({ secretKey: this.secretKey });
      const user = await clerk.users.getUser(clerkUserId);
      const primary =
        user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null;
      const profile = { email: email ?? primary, name: name ?? fullName };
      this.profileCache.set(clerkUserId, { ...profile, expiresAt: Date.now() + PROFILE_TTL_MS });
      return profile;
    } catch {
      return { email, name };
    }
  }
}
