import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const BEARER = /^Bearer\s+([^.\s]+)\.([^.\s]+)\.[^.\s]+$/i;
const SUBJECT = /"sub"\s*:\s*"([^"]{1,128})"/;

/**
 * Who a request counts against. Dashboard traffic reaches the API through
 * Vercel's /backend rewrite, so most requests share a handful of Vercel IPs —
 * limiting by IP alone would throttle every firm together. Signed-in requests
 * count against the user instead:
 *   1. Clerk JWT `sub` (read without verifying — AuthGuard still verifies; a
 *      forged sub only buys more 401s),
 *   2. the dev-seam tenant/user headers,
 *   3. the client IP Caddy sets in X-Real-IP (unspoofable behind Caddy),
 *      falling back to the socket address.
 */
export function throttleTracker(req: Request): string {
  const auth = req.headers.authorization;
  const jwt = typeof auth === 'string' ? BEARER.exec(auth) : null;
  if (jwt?.[2]) {
    const sub = SUBJECT.exec(Buffer.from(jwt[2], 'base64url').toString('utf8'))?.[1];
    if (sub) return `user:${sub}`;
  }
  const tenant = req.headers['x-tenant-id'];
  if (typeof tenant === 'string' && tenant.length > 0) {
    const user = req.headers['x-user-id'];
    return `dev:${tenant}:${typeof user === 'string' ? user : ''}`;
  }
  const realIp = req.headers['x-real-ip'];
  return `ip:${typeof realIp === 'string' && realIp.length > 0 ? realIp : (req.ip ?? 'unknown')}`;
}

/** Global HTTP rate limit (OWASP API4). Webhooks and health opt out. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Request): Promise<string> {
    return Promise.resolve(throttleTracker(req));
  }
}
