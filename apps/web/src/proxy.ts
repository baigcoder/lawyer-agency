import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { clerkEnabled } from '@/lib/env';

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Next.js 16 convention: `proxy.ts` is the request-edge hook (successor to
 * middleware.ts). When Clerk keys are absent (local dev seam, D-037) the
 * proxy is a pass-through and the dashboard shows its dev banner; production
 * always has keys (env fail-fast) and protects every /dashboard route.
 *
 * Dashboard requires a Clerk organization (the firm). One owner creates one
 * organization during onboarding; extra orgs cannot be created from the app.
 * Signed-in users without an org are sent to /onboarding (D-116).
 *
 * For /backend/* rewrites we forward the Clerk session token as an
 * Authorization header so the API can verify identity (Phase 10, D-017).
 * In dev-seam mode we forward the configured tenant/user headers instead.
 */
export default clerkEnabled
  ? clerkMiddleware(
      async (auth, req) => {
        const pathname = req.nextUrl.pathname;
        const isDashboard = matchesPrefix(pathname, '/dashboard');
        const isOnboarding = matchesPrefix(pathname, '/onboarding');
        const isResetPassword = matchesPrefix(pathname, '/reset-password');
        if (isDashboard || isOnboarding || isResetPassword) {
          const session = await auth({ treatPendingAsSignedOut: false });
          if (!session.userId) {
            await auth.protect();
          }
          const pending = session.sessionStatus === 'pending';
          // Pending + org: usually Clerk `reset-password` (team invite temp password).
          // Do not send those users to firm setup /onboarding.
          if (isDashboard && pending && session.orgId) {
            return NextResponse.redirect(new URL('/reset-password', req.url));
          }
          if (isDashboard && !session.orgId) {
            return NextResponse.redirect(new URL('/onboarding', req.url));
          }
        }
        if (matchesPrefix(pathname, '/backend')) {
          const session = await auth();
          const token = await session.getToken();
          if (token) {
            const headers = new Headers(req.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return NextResponse.next({ request: { headers } });
          }
        }
        return NextResponse.next();
      },
    )
  : function devProxy(req: NextRequest) {
      if (matchesPrefix(req.nextUrl.pathname, '/backend')) {
        const headers = new Headers(req.headers);
        const tenantId = process.env.NEXT_PUBLIC_DEV_TENANT_ID;
        const userId = process.env.NEXT_PUBLIC_DEV_USER_ID;
        if (tenantId) headers.set('x-tenant-id', tenantId);
        if (userId) headers.set('x-user-id', userId);
        return NextResponse.next({ request: { headers } });
      }
      return NextResponse.next();
    };

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
