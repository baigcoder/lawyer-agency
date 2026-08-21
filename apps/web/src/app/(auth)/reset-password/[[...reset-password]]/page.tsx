import { TaskResetPassword } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clerkEnabled } from '@/lib/env';

/**
 * Clerk session task for forced password change (team invite temp passwords).
 * Wired via ClerkProvider `taskUrls['reset-password']` (D-116 credentials invite).
 */
export default function ResetPasswordPage() {
  if (!clerkEnabled) {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Password change</CardTitle>
            <CardDescription>Clerk is not configured in this environment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/sign-in" />}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <TaskResetPassword redirectUrlComplete="/dashboard" />
    </main>
  );
}
