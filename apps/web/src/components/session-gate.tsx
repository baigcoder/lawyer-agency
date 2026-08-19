'use client';

import { Loader2 } from 'lucide-react';
import { ForbiddenState } from '@/components/forbidden-state';
import { UserMenu } from '@/components/user-menu';
import { ApiError } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/env';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';

/**
 * Blocks the dashboard chrome until `/v1/auth/me` resolves. Unknown Clerk
 * org members (not invited) get a 403 with a logout control.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { isPending, isError, error } = useSession();

  if (isPending) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError && error instanceof ApiError && error.status === 403) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-6">
        <ForbiddenState title={t('accessDenied')} description={t('askOwnerToInvite')} showHome={false} />
        <div className="mt-4">
          <UserMenu />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center text-sm text-destructive">
        {t('couldNotLoadSession')}
        {error instanceof ApiError && error.correlationId ? (
          <span className="text-xs text-muted-foreground">correlation id: {error.correlationId}</span>
        ) : null}
        {clerkEnabled ? (
          <div className="mt-4">
            <UserMenu />
          </div>
        ) : null}
      </div>
    );
  }

  return children;
}
