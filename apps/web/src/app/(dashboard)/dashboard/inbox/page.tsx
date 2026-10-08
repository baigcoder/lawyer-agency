'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Inbox as InboxIcon, Loader2 } from 'lucide-react';
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

type InboxTabValue = ConversationState | 'ALL' | 'UNASSIGNED' | 'ME';

const tabs: Array<{ labelKey: TranslationKey; value: InboxTabValue }> = [
  { labelKey: 'inboxTabAll', value: 'ALL' },
  { labelKey: 'inboxTabNeedsHuman', value: 'HUMAN_REQUIRED' },
  { labelKey: 'inboxTabAiActive', value: 'AI_ACTIVE' },
  { labelKey: 'inboxTabHumanActive', value: 'HUMAN_ACTIVE' },
  { labelKey: 'inboxTabMine', value: 'ME' },
  { labelKey: 'inboxTabUnassigned', value: 'UNASSIGNED' },
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {listQuery.isError ? (
        <div role="alert" className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center justify-between">
          <span>{t('couldntLoadInbox')}: {listQuery.error.message}</span>
          {listQuery.error instanceof ApiError && listQuery.error.correlationId ? (
            <span className="font-mono text-[10px] opacity-80">
              id: {listQuery.error.correlationId}
            </span>
          ) : null}
        </div>
      ) : null}

      {showConnectPrompt ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center space-y-4 px-4 py-12">
          <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t('connectWhatsapp')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {canManageWhatsapp ? t('inboxConnectWhatsappHint') : t('askOwnerToConnectWhatsapp')}
              </p>
            </div>
            {canManageWhatsapp ? <WhatsappConnectionCard /> : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Triage List Pane */}
          <div
            className={cn(
              'flex w-full shrink-0 flex-col border-e border-border bg-sunken/60 md:w-[300px] lg:w-[320px] xl:w-[340px]',
              selectedId && 'hidden md:flex',
            )}
          >
            {listQuery.isPending ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                  <h1 className="text-base font-semibold tracking-tight text-foreground">
                    {t('inboxChats')}
                  </h1>
                </div>
                <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading inbox">
                  {Array.from({ length: 7 }, (_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
              />
            )}
          </div>

          {/* Timeline & Context Region */}
          <div className={cn('min-w-0 flex-1 flex-col overflow-hidden', selectedId ? 'flex' : 'hidden md:flex')}>
            {selectedId ? (
              detailQuery.isPending ? (
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-2.5 text-muted-foreground"
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs">{t('inboxLoading')}</p>
                </div>
              ) : detailQuery.isError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <InboxIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p role="alert" className="text-sm font-semibold text-destructive">
                      {t('inboxLoadError')}
                    </p>
                    {detailQuery.error instanceof ApiError && detailQuery.error.correlationId ? (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        correlation id: {detailQuery.error.correlationId}
                      </p>
                    ) : null}
                  </div>
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
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="font-display text-3xl">{t('tlSelectTitle')}</p>
                <p className="max-w-sm text-sm text-muted-foreground">{t('tlSelectDesc')}</p>
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
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <div className="flex w-full shrink-0 flex-col border-e border-border bg-sunken/60 md:w-[300px] lg:w-[320px] xl:w-[340px]">
        <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {t('inboxChats')}
          </h1>
        </div>
        <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading inbox">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 md:flex bg-card/20">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-4 w-48" />
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
