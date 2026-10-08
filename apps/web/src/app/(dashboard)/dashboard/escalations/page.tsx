'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, signalRule, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/workspace/panel';
import { SlaClock } from '@/components/workspace/sla-clock';
import { apiRequest, ApiError } from '@/lib/api-client';
import { timeAgo } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import {
  escalationListSchema,
  escalationSummarySchema,
  type EscalationStatus,
  type EscalationSummary,
} from '@/lib/schemas/escalations';
import { cn } from '@/lib/utils';

const POLL_MS = 5_000;

const tabs = [
  { labelKey: 'tabOpen', value: 'OPEN' },
  { labelKey: 'tabAcknowledged', value: 'ACKNOWLEDGED' },
  { labelKey: 'tabResolved', value: 'RESOLVED' },
  { labelKey: 'tabAll', value: 'ALL' },
] as const;

function levelOf(e: EscalationSummary): SignalLevel {
  if (e.status === 'RESOLVED') return 'info';
  if (e.status === 'ACKNOWLEDGED') return 'routine';
  return e.triggerType === 'IMMINENT_DEADLINE' || e.triggerType === 'MANUAL' ? 'urgent' : 'critical';
}

/**
 * Escalations — the lawyer handoff queue. Oldest deadline first on the start
 * side; the selected matter's brief, clock and the one consequential action
 * ("Acknowledge & claim") on the other.
 */
export default function EscalationsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<EscalationStatus | 'ALL'>('OPEN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['escalations', tab],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tab !== 'ALL') params.set('status', tab);
      return apiRequest(`/v1/escalations?${params.toString()}`, { schema: escalationListSchema });
    },
    refetchInterval: POLL_MS,
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/escalations/${id}/acknowledge`, { method: 'POST', schema: escalationSummarySchema }),
    onSuccess: () => {
      toast.success(t('escAcknowledged'));
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('escActionFailed')),
  });

  const resolve = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/escalations/${id}/resolve`, { method: 'POST', schema: escalationSummarySchema }),
    onSuccess: () => {
      toast.success(t('escResolvedToast'));
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('escActionFailed')),
  });

  const items = [...(list.data ?? [])].sort((a, b) => a.slaDeadline.getTime() - b.slaDeadline.getTime());
  const active = items.find((e) => e.id === selectedId) ?? items[0];
  const openCount = items.filter((i) => i.status === 'OPEN').length;
  const breachedCount = items.filter((i) => i.slaBreached && i.status !== 'RESOLVED').length;

  return (
    <div>
      <PageHeader
        eyebrow={`${openCount} ${t('demoOpenEsc')} · ${breachedCount} ${t('escBreached')} · ${t('demoSlaTarget')}`}
        title={t('escalations')}
        description={t('demoEscLede')}
      />

      <div role="tablist" aria-label={t('escalations')} className="mb-4 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => {
              setTab(item.value);
              setSelectedId(null);
            }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              tab === item.value ? 'bg-card font-medium shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {list.isError ? (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-critical/[0.06] px-4 py-3 ring-1 ring-critical/25">
          <p className="text-sm">{list.error instanceof ApiError ? list.error.message : t('escActionFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
            {t('inboxTryAgain')}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel title={t('demoQueue')} meta={t('demoQueueMeta')} bodyClassName="p-1.5">
          {list.isPending ? (
            <div className="space-y-2 p-2" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : null}
          {list.isSuccess && items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto size-6 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-medium">{t('escEmptyTitle')}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t('escEmptyDesc')}</p>
            </div>
          ) : null}
          <ul className="space-y-1">
            {items.map((e) => {
              const level = levelOf(e);
              const selected = e.id === active?.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'relative w-full rounded-lg px-4 py-3 text-start transition-colors',
                      'before:absolute before:inset-y-3 before:start-0 before:w-[3px] before:rounded-full',
                      signalRule(level),
                      selected ? 'bg-accent/50 ring-1 ring-primary/25' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <Signal level={level}>{t(`escTrigger${e.triggerType}`)}</Signal>
                      {e.status === 'OPEN' ? (
                        <SlaClock deadline={e.slaDeadline} />
                      ) : (
                        <span className="docket text-muted-foreground">
                          {e.status === 'ACKNOWLEDGED' ? t('demoClaimed') : t('demoResolved')}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-[13.5px] font-medium">{e.client.name ?? e.client.waPhone}</span>
                    <Docket items={[e.assignedTo?.name ?? t('demoUnassigned'), timeAgo(e.createdAt)]} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {active ? (
          <Panel
            title={active.client.name ?? active.client.waPhone}
            meta={`${t(`escTrigger${active.triggerType}`)} · ${active.assignedTo?.name ?? t('demoUnassigned')}`}
            action={active.status === 'OPEN' ? <SlaClock deadline={active.slaDeadline} className="text-sm" /> : null}
            bodyClassName="p-5"
          >
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {active.status === 'OPEN' ? (
                <Button className="h-9" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(active.id)}>
                  {t('escAckClaim')}
                </Button>
              ) : null}
              {active.status === 'ACKNOWLEDGED' ? (
                <Button className="h-9" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate(active.id)}>
                  <CheckCircle2 aria-hidden />
                  {t('demoMarkResolved')}
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                variant="ghost"
                className="h-9"
                render={<Link href={`/dashboard/inbox?conversation=${active.conversationId}`} />}
              >
                <MessageSquareText aria-hidden />
                {t('demoOpenConversation')}
              </Button>
              {active.status !== 'OPEN' ? (
                <span className="ms-auto">
                  <Signal level={active.status === 'RESOLVED' ? 'ok' : 'routine'}>
                    {active.status === 'RESOLVED'
                      ? t('demoResolved')
                      : `${t('demoClaimed')}${active.acknowledgerName ? ` · ${active.acknowledgerName}` : ''}`}
                  </Signal>
                </span>
              ) : null}
            </div>
            <HandoffBriefView reason={active.handoffReason} excerpt={active.detectedExcerpt} brief={active.handoffBrief} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
