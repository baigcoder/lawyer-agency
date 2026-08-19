'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/env';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import { sessionSchema, type Session } from '@/lib/schemas/session';

interface SessionValue {
  session: Session | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  can: (permission: string) => boolean;
  canAny: (permissions: readonly string[]) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

function useSessionQuery(getToken: () => Promise<string | null>, enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      return apiRequest('/v1/auth/me', { token, schema: sessionSchema });
    },
  });
}

function SessionValueProvider({
  session,
  isPending,
  isError,
  error,
  children,
}: {
  session: Session | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  children: ReactNode;
}) {
  const value: SessionValue = {
    session,
    isPending,
    isError,
    error,
    can: (permission) => hasPermission(session?.permissions, permission),
    canAny: (permissions) => hasAnyPermission(session?.permissions, permissions),
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function ClerkSessionProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const query = useSessionQuery(() => getToken(), isLoaded);
  return (
    <SessionValueProvider
      session={query.data}
      isPending={!isLoaded || query.isPending}
      isError={query.isError}
      error={query.error}
    >
      {children}
    </SessionValueProvider>
  );
}

function DevSessionProvider({ children }: { children: ReactNode }) {
  const query = useSessionQuery(async () => null, true);
  return (
    <SessionValueProvider
      session={query.data}
      isPending={query.isPending}
      isError={query.isError}
      error={query.error}
    >
      {children}
    </SessionValueProvider>
  );
}

/**
 * Loads `/v1/auth/me` once per dashboard session and exposes `can()` for nav
 * and route guards. Clerk tokens are attached only when Clerk is enabled.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  if (clerkEnabled) return <ClerkSessionProvider>{children}</ClerkSessionProvider>;
  return <DevSessionProvider>{children}</DevSessionProvider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
