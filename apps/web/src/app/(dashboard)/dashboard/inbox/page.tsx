'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Inbox as InboxIcon, Loader2, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
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
          <span>Couldn&apos;t load inbox: {listQuery.error.message}</span>
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
              <h2 className="text-base font-semibold text-foreground">Connect WhatsApp Front Desk</h2>
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
              'flex w-full shrink-0 flex-col border-r border-border/60 bg-card/40 md:w-[320px] lg:w-[350px] xl:w-[380px]',
              selectedId && 'hidden md:flex',
            )}
          >
            {listQuery.isPending ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                  <MobileNav className="lg:hidden" />
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
                leading={<MobileNav className="lg:hidden" />}
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
              /* Linear-style calm empty state when no conversation selected */
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center bg-card/20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm text-primary">
                  <MessageSquare className="h-8 w-8" aria-hidden />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Select a conversation to triage
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pick an active client inquiry from the queue or search by client phone, name, or case reference.
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>AI auto-intakes &amp; drafts responses</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    <span>Lawyer oversight required for escalation</span>
                  </div>
                </div>
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
      <div className="flex w-full shrink-0 flex-col border-r border-border/60 bg-card/40 md:w-[320px] lg:w-[350px] xl:w-[380px]">
        <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
          <MobileNav className="lg:hidden" />
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
