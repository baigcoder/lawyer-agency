import { SignUp } from '@clerk/nextjs';
import { DevAuthPage } from '@/components/dev-auth-page';
import { clerkEnabled } from '@/lib/env';

export default function SignUpPage() {
  if (!clerkEnabled) {
    return <DevAuthPage mode="sign-up" />;
  }
  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signInForceRedirectUrl="/dashboard"
        signInFallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
