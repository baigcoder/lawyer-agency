'use client';

import { usePathname } from 'next/navigation';
import { ForbiddenState } from '@/components/forbidden-state';
import { requiredPermissionsForPath } from '@/lib/permissions';
import { useSession } from '@/lib/session';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, canAny } = useSession();
  const required = requiredPermissionsForPath(pathname);
  if (required && session && !canAny(required)) {
    return <ForbiddenState />;
  }
  return children;
}
