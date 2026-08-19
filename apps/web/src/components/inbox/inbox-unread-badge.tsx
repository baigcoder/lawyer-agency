'use client';

import { formatInboxUnread, useInboxUnreadCount } from '@/lib/inbox-unread';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export function InboxUnreadBadge({ className }: { className?: string }) {
  const { t } = useLanguage();
  const unread = useInboxUnreadCount();
  if (unread <= 0) return null;

  return (
    <span
      className={cn(
        'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground',
        className,
      )}
      aria-label={t('inboxUnreadCount').replace('{count}', String(unread))}
    >
      {formatInboxUnread(unread)}
    </span>
  );
}
