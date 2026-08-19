'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { inboxListSchema, type InboxSummary } from '@/lib/schemas/inbox';
import { useSession } from '@/lib/session';

export const INBOX_POLL_MS = 5_000;

/** Shared with the inbox All-tab list so the sidebar badge does not double-fetch. */
export const INBOX_ALL_QUERY_KEY = ['inbox', 'ALL', ''] as const;

export function inboxUnreadTotal(conversations: readonly InboxSummary[]): number {
  return conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
}

export function formatInboxUnread(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function latestClientConversation(
  conversations: readonly InboxSummary[],
): InboxSummary | null {
  let latest: InboxSummary | null = null;
  for (const conversation of conversations) {
    const at = conversation.lastClientMessageAt?.getTime() ?? 0;
    const latestAt = latest?.lastClientMessageAt?.getTime() ?? 0;
    if (at > latestAt) latest = conversation;
  }
  return latest;
}

export function useInboxListQuery() {
  const { can } = useSession();
  return useQuery({
    queryKey: INBOX_ALL_QUERY_KEY,
    queryFn: () => apiRequest('/v1/inbox', { schema: inboxListSchema }),
    enabled: can('inbox:read'),
    refetchInterval: INBOX_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useInboxUnreadCount(): number {
  const query = useInboxListQuery();
  return query.data ? inboxUnreadTotal(query.data) : 0;
}
