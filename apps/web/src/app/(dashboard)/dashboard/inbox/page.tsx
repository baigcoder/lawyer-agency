'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Inbox as InboxIcon, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/lib/translations';
import { INBOX_POLL_MS } from '@/lib/inbox-unread';
import { inboxListSchema, inboxDetailSchema, type ConversationState } from '@/lib/schemas/inbox';
import { evolutionConnectionStatusSchema } from '@/lib/schemas/whatsapp';
import { ConversationList } from '@/components/inbox/conversation-list';
import { ConversationDetail } from '@/components/inbox/conversation-detail';
import { WhatsappConnectionCard } from '@/components/whatsapp-connection-card';
import { MobileNav } from '@/components/mobile-nav';

type InboxTabValue = ConversationState | 'ALL' | 'UNASSIGNED' | 'ME';

const tabs: Array<{ labelKey: TranslationKey; value: InboxTabValue }> = [
  { labelKey: 'inboxTabAll', value: 'ALL' },
  { labelKey: 'inboxTabAiActive', value: 'AI_ACTIVE' },
  { labelKey: 'inboxTabNeedsHuman', value: 'HUMAN_REQUIRED' },
  { labelKey: 'inboxTabHumanActive', value: 'HUMAN_ACTIVE' },
  { labelKey: 'inboxTabUnassigned', value: 'UNASSIGNED' },
  { labelKey: 'inboxTabMine', value: 'ME' },
  { labelKey: 'inboxTabClosed', value: 'CLOSED' },
];

function InboxContent() {
  const { t } = useLanguage();
  const { can, session } = useSession();
  const canManageWhatsapp = can('whatsapp:manage');
  const searchParams = useSearchParams();
  const conversationFromUrl = searchParams.get('conversation');
  const tabFromUrl = searchParams.get('tab');
  const defaultTab: InboxTabValue =
    tabFromUrl === 'ME' ||
    tabFromUrl === 'UNASSIGNED' ||
    tabFromUrl === 'ALL' ||
    tabFromUrl === 'AI_ACTIVE' ||
    tabFromUrl === 'HUMAN_REQUIRED' ||
    tabFromUrl === 'HUMAN_ACTIVE' ||
    tabFromUrl === 'CLOSED'
      ? tabFromUrl
      : session?.role === 'Staff' || session?.role === 'Lawyer'
        ? 'ME'
        : 'HUMAN_REQUIRED';
  const [selectedId, setSelectedId] = useState<string | null>(conversationFromUrl);
  const [activeTab, setActiveTab] = useState<InboxTabValue>(defaultTab);
  const [search, setSearch] = useState('');

  const [syncedParam, setSyncedParam] = useState<string | null>(conversationFromUrl);
  if (conversationFromUrl !== syncedParam) {
    setSyncedParam(conversationFromUrl);
    if (conversationFromUrl) {
      setSelectedId(conversationFromUrl);
    }
  }

  const whatsapp = useQuery({
    queryKey: ['whatsapp', 'connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'connecting' ? 2_000 : 10_000),
  });
  const whatsappReady = whatsapp.data?.status === 'connected';
  const showConnectPrompt = whatsapp.isSuccess && !whatsappReady;

  const listQuery = useQuery({
    queryKey: ['inbox', activeTab, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL' && activeTab !== 'UNASSIGNED' && activeTab !== 'ME') {
        params.set('state', activeTab);
      }
      if (activeTab === 'UNASSIGNED') params.set('unassigned', 'true');
      if (activeTab === 'ME') params.set('assignedToMe', 'true');
      if (search.trim()) params.set('q', search.trim());
      return apiRequest(`/v1/inbox?${params.toString()}`, { schema: inboxListSchema });
    },
    enabled: !showConnectPrompt,
    refetchInterval: whatsappReady ? INBOX_POLL_MS : false,
    refetchOnWindowFocus: true,
  });

  const detailQuery = useQuery({
    queryKey: ['inbox', selectedId],
    queryFn: () =>
      apiRequest(`/v1/inbox/${selectedId}`, { schema: inboxDetailSchema }),
    enabled: Boolean(selectedId) && !showConnectPrompt,
    refetchInterval: selectedId && whatsappReady ? INBOX_POLL_MS : false,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="wa-inbox flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--wa-list-bg)' }}>
      {listQuery.isError ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          Couldn&apos;t load inbox: {listQuery.error.message}
          {listQuery.error instanceof ApiError && listQuery.error.correlationId ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              correlation id: {listQuery.error.correlationId}
            </span>
          ) : null}
        </p>
      ) : null}

      {showConnectPrompt ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center space-y-3 px-4">
          <p className="text-sm text-muted-foreground">
            {canManageWhatsapp ? t('inboxConnectWhatsappHint') : t('askOwnerToConnectWhatsapp')}
          </p>
          {canManageWhatsapp ? <WhatsappConnectionCard /> : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              'flex w-full shrink-0 flex-col md:w-[30%] md:min-w-[320px] md:max-w-[420px]',
              selectedId && 'hidden md:flex',
            )}
            style={{ borderInlineEnd: '1px solid var(--wa-border)' }}
          >
            {listQuery.isPending ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-1 px-3 pb-1.5 pt-3">
                  <MobileNav className="lg:hidden" />
                  <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--wa-name)' }}>
                    {t('inboxChats')}
                  </h1>
                </div>
                <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading inbox">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-none" />
                  ))}
                </div>
              </div>
            ) : (
              <ConversationList
                conversations={listQuery.data ?? []}
                selectedId={selectedId}
                activeTab={activeTab}
                tabs={tabs.map((tab) => ({ label: t(tab.labelKey), value: tab.value }))}
                search={search}
                onSelect={setSelectedId}
                onTabChange={setActiveTab}
                onSearch={setSearch}
                leading={<MobileNav className="lg:hidden" />}
              />
            )}
          </div>

          <div className={cn('min-w-0 flex-1 flex-col overflow-hidden', selectedId ? 'flex' : 'hidden md:flex')}>
            {selectedId ? (
              detailQuery.isPending ? (
                <div
                  className="wa-thread flex flex-1 flex-col items-center justify-center gap-2"
                  style={{ color: 'var(--wa-meta)' }}
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">{t('inboxLoading')}</p>
                </div>
              ) : detailQuery.isError ? (
                <div className="wa-thread flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <InboxIcon className="h-8 w-8" style={{ color: 'var(--wa-meta)' }} />
                  <p role="alert" className="text-sm text-destructive">{t('inboxLoadError')}</p>
                  {detailQuery.error instanceof ApiError && detailQuery.error.correlationId ? (
                    <p className="text-xs" style={{ color: 'var(--wa-meta)' }}>
                      correlation id: {detailQuery.error.correlationId}
                    </p>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => void detailQuery.refetch()}>
                    {t('inboxTryAgain')}
                  </Button>
                </div>
              ) : detailQuery.isSuccess ? (
                <ConversationDetail
                  detail={detailQuery.data}
                  onBack={() => setSelectedId(null)}
                />
              ) : null
            ) : (
              <div className="wa-thread flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--wa-filter) 16%, transparent)' }}
                >
                  <LockKeyhole className="h-9 w-9" style={{ color: 'var(--wa-filter)' }} aria-hidden />
                </div>
                <div>
                  <p className="text-[32px] font-light tracking-tight" style={{ color: 'var(--wa-name)' }}>
                    {t('inboxEmptyTitle')}
                  </p>
                  <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--wa-meta)' }}>
                    {t('inboxEmptyHint')}
                  </p>
                </div>
                <p
                  className="mt-4 flex max-w-md items-start justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] leading-4"
                  style={{ background: 'var(--wa-system)', color: 'var(--wa-encrypt-fg)' }}
                >
                  <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {t('inboxEncrypted')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InboxSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="wa-inbox flex min-h-0 flex-1 overflow-hidden" style={{ background: 'var(--wa-list-bg)' }}>
      <div
        className="flex w-full shrink-0 flex-col md:w-[30%] md:min-w-[320px] md:max-w-[420px]"
        style={{ borderInlineEnd: '1px solid var(--wa-border)' }}
      >
        <div className="flex items-center gap-1 px-3 pb-1.5 pt-3">
          <MobileNav className="lg:hidden" />
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--wa-name)' }}>
            {t('inboxChats')}
          </h1>
        </div>
        <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading inbox">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
      <div className="wa-thread hidden flex-1 flex-col items-center justify-center gap-3 md:flex">
        <p className="text-sm" style={{ color: 'var(--wa-meta)' }}>{t('inboxEmptyHint')}</p>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
