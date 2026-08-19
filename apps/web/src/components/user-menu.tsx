'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountMenu } from '@/components/account-menu';
import { clerkEnabled } from '@/lib/env';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { firmProfileReadSchema } from '@/lib/schemas/firm-profile';
import { lawyerProfileSchema } from '@/lib/schemas/lawyer-profile';

const ClerkAccountMenu = dynamic(
  () => import('./clerk-user-menu').then((mod) => mod.ClerkAccountMenu),
  { ssr: false },
);

function DevAccountMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const lawyer = useQuery({
    queryKey: ['lawyer-profile', 'me'],
    queryFn: () => apiRequest('/v1/lawyers/me/profile', { schema: lawyerProfileSchema }),
    retry: false,
  });
  const firm = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileReadSchema }),
    retry: false,
  });

  const name = lawyer.data?.name ?? firm.data?.displayName ?? firm.data?.firmName ?? t('yourFirm');
  const email = lawyer.data?.email ?? null;

  return (
    <AccountMenu
      name={name}
      email={email}
      onLogout={() => {
        queryClient.clear();
        router.push('/');
      }}
    />
  );
}

/**
 * Logged-in account control: avatar (Clerk photo when auth is on; initials from
 * the lawyer/firm profile in the dev seam). Clicking opens Logout, which clears
 * the TanStack Query cache so the next session refetches from the API.
 */
export function UserMenu() {
  if (clerkEnabled) return <ClerkAccountMenu />;
  return <DevAccountMenu />;
}
