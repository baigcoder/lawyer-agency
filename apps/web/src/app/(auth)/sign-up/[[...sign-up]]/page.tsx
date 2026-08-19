import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { clerkEnabled } from '@/lib/env';

export default function SignUpPage() {
  if (!clerkEnabled) {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">
          Auth is disabled in this dev environment.{' '}
          <Link href="/dashboard" className="text-primary underline">
            Continue to dashboard
          </Link>
        </p>
      </main>
    );
  }
  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <SignUp fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
