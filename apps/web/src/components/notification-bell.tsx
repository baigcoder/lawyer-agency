'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/api-client';
import { humanizeEnum, timeAgo } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { notificationListSchema, unreadCountSchema, type NotificationDto } from '@/lib/schemas/notifications';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const KEY = ['notifications'] as const;

/** Only same-app paths: the url comes from the API and is used for navigation. */
function safeUrl(url: string | undefined): string | null {
  return url && url.startsWith('/dashboard') ? url : null;
}

export function NotificationBell() {
  const { t } = useLanguage();
  const { can } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = can('notifications:read');

  const unread = useQuery({
    queryKey: [...KEY, 'unread-count'],
    queryFn: () => apiRequest('/v1/notifications/unread-count', { schema: unreadCountSchema }),
    refetchInterval: 30_000,
    retry: false,
    enabled: allowed,
  });
  const list = useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: () => apiRequest('/v1/notifications?limit=20', { schema: notificationListSchema }),
    retry: false,
    enabled: allowed,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/notifications/${id}/read`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  if (!allowed) return null;
  const count = unread.data ?? 0;
  const items = list.data ?? [];

  function open(item: NotificationDto) {
    if (!item.readAt) markRead.mutate(item.id);
    const url = safeUrl(item.payload.url);
    if (url) router.push(url);
  }

  return (
    <DropdownMenu onOpenChange={(isOpen) => isOpen && void list.refetch()}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={count > 0 ? t('notificationsUnread').replace('{count}', String(count)) : t('notifications')}
          />
        }
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-none text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('notifications')}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('notificationsEmpty')}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => open(item)} className="items-start gap-2 py-2">
                <span
                  aria-hidden
                  className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', !item.readAt && 'font-medium')}>
                    {item.payload.title ?? humanizeEnum(item.type.replace('.', '_'))}
                  </span>
                  {item.payload.body ? (
                    <span className="block line-clamp-2 text-xs text-muted-foreground">{item.payload.body}</span>
                  ) : null}
                  <span className="block text-[11px] text-muted-foreground/80">{timeAgo(item.createdAt)}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
