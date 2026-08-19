'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Root error boundary (Batch 2d). A branded, recoverable error page
 * instead of Next's default unstyled one — important for the onboarding
 * wizard where a JS error mid-flow would otherwise lose all form state
 * with no recovery UI.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Console keeps the digest for server-side correlation without leaking
    // it to the end user (who sees only the branded card).
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Scale className="h-5 w-5" aria-hidden />
        Wakeel
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. Your data is
          safe — try again, and if the problem persists contact your firm administrator.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </main>
  );
}
