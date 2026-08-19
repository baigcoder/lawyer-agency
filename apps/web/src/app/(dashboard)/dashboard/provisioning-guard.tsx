'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { apiRequest, ApiError } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/env';

const provisioningStatusSchema = z.object({
  provisioned: z.boolean(),
  tenantId: z.string().nullable(),
});

/**
 * Redirects members of unprovisioned organizations to /onboarding instead of
 * showing a 401 storm (D-093). Only runs when Clerk is enabled; the dev seam
 * tenant is always provisioned by definition.
 */
export function ProvisioningGuard({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const status = useQuery({
    queryKey: ['firm-provisioning', 'status'],
    enabled: clerkEnabled && isLoaded,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { provisioned: false, tenantId: null };
      return apiRequest('/v1/firm-provisioning/status', { token, schema: provisioningStatusSchema });
    },
    retry: false,
  });

  // Move the redirect out of render into an effect (side-effect-in-render is fragile).
  useEffect(() => {
    if (status.data && !status.data.provisioned && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [status.data, pathname, router]);

  if (clerkEnabled && status.isError) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center text-sm text-destructive">
        Couldn&apos;t confirm your organization&apos;s setup.
        {status.error instanceof ApiError && status.error.correlationId && (
          <span className="text-xs text-muted-foreground">
            correlation id: {status.error.correlationId}
          </span>
        )}
        <button
          type="button"
          className="text-sm underline"
          onClick={() => status.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (clerkEnabled && status.isPending) {
    return (
      <div role="status" aria-live="polite" aria-label="Confirming your firm setup" className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (clerkEnabled && status.data && !status.data.provisioned) {
    return (
      <div role="status" aria-live="polite" aria-label="Redirecting to onboarding" className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return children;
}
