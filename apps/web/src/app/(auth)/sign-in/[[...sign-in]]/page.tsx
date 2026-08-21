import { SignIn } from '@clerk/nextjs';
import { DevAuthPage } from '@/components/dev-auth-page';
import { clerkEnabled } from '@/lib/env';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  if (!clerkEnabled) {
    return <DevAuthPage mode="sign-in" />;
  }

  const params = await searchParams;
  const rawEmail = params.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : undefined;

  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        initialValues={email ? { emailAddress: email } : undefined}
      />
    </main>
  );
}
