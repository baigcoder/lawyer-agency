'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { AccountMenu } from '@/components/account-menu';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';

export function ClerkAccountMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { t } = useLanguage();
  const name = session?.name ?? user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account';
  const email = session?.email ?? user?.primaryEmailAddress?.emailAddress ?? null;
  const imageUrl = user?.imageUrl ?? null;
  const roleLabel =
    session?.role === 'Admin'
      ? t('roleOwner')
      : session?.role === 'Lawyer'
        ? t('roleLawyer')
        : session?.role === 'Staff'
          ? t('roleStaff')
          : session?.role ?? null;

  return (
    <div className="flex items-center gap-1">
      <AccountMenu
        name={name}
        email={email}
        role={roleLabel}
        imageUrl={imageUrl}
        onLogout={() => {
          queryClient.clear();
          void signOut({ redirectUrl: '/' });
        }}
      />
    </div>
  );
}
