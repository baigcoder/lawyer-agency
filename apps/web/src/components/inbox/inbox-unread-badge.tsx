'use client';

import { NavCount } from '@/components/shell/app-sidebar';
import { useInboxUnreadCount } from '@/lib/inbox-unread';
import { useLanguage } from '@/lib/language';

export function InboxUnreadBadge() {
  const { t } = useLanguage();
  const unread = useInboxUnreadCount();
  if (unread <= 0) return null;
  return (
    <span aria-label={t('inboxUnreadCount').replace('{count}', String(unread))}>
      <NavCount count={unread} />
    </span>
  );
}
