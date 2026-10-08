'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentRequestsCard } from '@/components/document-requests-card';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, SignalDot, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/workspace/panel';
import { apiRequest, ApiError } from '@/lib/api-client';
import { factLabel } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { caseListSchema, type CaseDto } from '@/lib/schemas/case';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const STAGES: CaseDto['status'][] = ['LEAD', 'CONSULTATION', 'ENGAGED', 'IN_COURT', 'CLOSED', 'ARCHIVED'];
const FILTERS = ['ALL', 'IN_COURT', 'ENGAGED', 'CONSULTATION', 'LEAD', 'CLOSED'] as const;
type StatusFilter = (typeof FILTERS)[number];

const statusKey: Record<CaseDto['status'], TranslationKey> = {
  LEAD: 'caseStatusLEAD',
  CONSULTATION: 'caseStatusCONSULTATION',
  ENGAGED: 'caseStatusENGAGED',
  IN_COURT: 'caseStatusIN_COURT',
  CLOSED: 'caseStatusCLOSED',
  ARCHIVED: 'caseStatusARCHIVED',
};

const urgencyKey: Record<CaseDto['urgency'], TranslationKey> = {
  CRITICAL: 'urgCRITICAL',
  HIGH: 'urgHIGH',
  NORMAL: 'urgNORMAL',
  LOW: 'urgLOW',
};

function urgencyLevel(u: CaseDto['urgency']): SignalLevel {
  return u === 'CRITICAL' ? 'critical' : u === 'HIGH' ? 'urgent' : u === 'NORMAL' ? 'routine' : 'info';
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Cases as a register of legal dossiers — the matter reference leads. */
export default function CasesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['cases', statusFilter === 'ALL' ? 'all' : statusFilter],
    queryFn: () =>
      apiRequest(`/v1/cases?status=${statusFilter === 'ALL' ? 'all' : 'open'}`, {
        schema: caseListSchema,
      }),
  });

  const filtered = useMemo(() => {
    let rows = query.data ?? [];
    if (statusFilter !== 'ALL') rows = rows.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.matterType.toLowerCase().includes(q) ||
          (c.summary && c.summary.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [query.data, statusFilter, search]);

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: CaseDto['status'] }) =>
      apiRequest(`/v1/cases/${id}/status`, { method: 'POST', body: { to } }),
    onSuccess: () => {
      toast.success(t('caseStageUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('caseStageFailed')),
  });

  const all = query.data ?? [];
  const openCount = all.filter((c) => c.status !== 'CLOSED' && c.status !== 'ARCHIVED').length;
  const active = all.find((c) => c.id === selectedId) ?? null;
  const cols = active
    ? 'lg:grid-cols-[6.5rem_minmax(0,2fr)_7rem_6rem_7rem] xl:grid-cols-[6.5rem_minmax(0,1fr)_7rem]'
    : 'lg:grid-cols-[6.5rem_minmax(0,2fr)_7rem_6rem_7rem]';
  const wide = active ? 'xl:hidden' : '';

  return (
    <div>
      <PageHeader
        eyebrow={`${openCount} ${t('demoOpenMatters')} · ${all.length} ${t('caseTotal')}`}
        title={t('cases')}
        description={t('demoCasesLede')}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label={t('cases')} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={statusFilter === f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                statusFilter === f ? 'bg-card font-medium shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f === 'ALL' ? t('demoAllMatters') : t(statusKey[f])}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {f === 'ALL' ? all.length : all.filter((c) => c.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('caseSearch')}
            aria-label={t('caseSearch')}
            className="h-8 ps-8 text-[13px]"
          />
        </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-4', active && 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
        <Panel bodyClassName="divide-y divide-border">
          <div className={cn('hidden gap-4 bg-sunken/70 px-4 py-2 lg:grid', cols)}>
            {[t('tlRef'), t('mfMatter'), t('demoStatus'), t('caseUrgency'), t('demoOpened')].map((h, i) => (
              <span key={h} className={cn('docket text-muted-foreground', i >= 3 && wide)}>
                {h}
              </span>
            ))}
          </div>
          {query.isPending ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : null}
          {query.isError ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-4 py-4">
              <p className="text-sm">{query.error instanceof ApiError ? query.error.message : t('caseLoadFailed')}</p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                {t('inboxTryAgain')}
              </Button>
            </div>
          ) : null}
          {query.isSuccess && filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-display text-2xl">{t('caseEmptyTitle')}</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">{t('caseEmptyDesc')}</p>
            </div>
          ) : null}
          {filtered.map((c) => {
            const selected = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(selected ? null : c.id)}
                aria-expanded={selected}
                className={cn(
                  'grid w-full grid-cols-1 gap-1 px-4 py-3 text-start transition-colors lg:items-center lg:gap-4',
                  cols,
                  selected ? 'bg-accent/45' : 'hover:bg-muted/40',
                )}
              >
                <span className="flex items-center gap-2 font-mono text-[13px] font-medium">
                  <SignalDot level={urgencyLevel(c.urgency)} />
                  {c.reference}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{c.matterType}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.summary ?? t('caseViaWhatsapp')}</span>
                </span>
                <span className="max-lg:hidden">
                  <span className="docket text-foreground/80">{t(statusKey[c.status])}</span>
                </span>
                <span className={cn('max-lg:hidden', wide)}>
                  <Signal level={urgencyLevel(c.urgency)}>{t(urgencyKey[c.urgency])}</Signal>
                </span>
                <span className={cn('font-mono text-[12.5px] tabular-nums text-muted-foreground max-lg:hidden', wide)}>
                  {fmtDate(c.openedAt)}
                </span>
                <Docket className="lg:hidden" items={[t(statusKey[c.status]), t(urgencyKey[c.urgency]), fmtDate(c.openedAt)]} />
              </button>
            );
          })}
        </Panel>

        {active ? (
          <aside
            aria-label={`${t('demoDossier')} ${active.reference}`}
            className="reveal-in fixed inset-0 z-50 overflow-y-auto bg-background xl:sticky xl:inset-auto xl:top-20 xl:z-auto xl:max-h-[calc(100svh-7rem)] xl:rounded-xl xl:bg-card xl:ring-1 xl:ring-border"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-inherit px-5 py-3">
              <Docket items={[t('demoDossier'), active.reference]} />
              <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={() => setSelectedId(null)}>
                <X aria-hidden />
              </Button>
            </div>
            <div className="space-y-6 p-5">
              <div>
                <Signal level={urgencyLevel(active.urgency)}>
                  {t(statusKey[active.status])} · {t(urgencyKey[active.urgency])}
                </Signal>
                <h2 className="mt-2 font-display text-[1.75rem] leading-[1.1]">{active.matterType}</h2>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {t('demoOpened')} {fmtDate(active.openedAt)}
                  {active.closedAt ? ` · ${t('caseStatusCLOSED')} ${fmtDate(active.closedAt)}` : ''}
                </p>
              </div>

              {active.summary ? (
                <section>
                  <h3 className="docket mb-1.5 text-muted-foreground">{t('briefSituation')}</h3>
                  <p className="text-sm leading-6">{active.summary}</p>
                </section>
              ) : null}

              {Object.keys(active.intakeData ?? {}).length > 0 ? (
                <section>
                  <h3 className="docket mb-2 text-muted-foreground">{t('briefFacts')}</h3>
                  <dl className="text-[13px]">
                    {Object.entries(active.intakeData).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2 border-b border-dashed border-border py-1.5">
                        <dt className="truncate text-muted-foreground">{factLabel(k)}</dt>
                        <dd className="font-medium">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              <section>
                <label htmlFor="case-stage" className="docket mb-2 block text-muted-foreground">
                  {t('caseStage')}
                </label>
                <Select
                  value={active.status}
                  onValueChange={(v) => v && transition.mutate({ id: active.id, to: v as CaseDto['status'] })}
                  disabled={transition.isPending}
                >
                  <SelectTrigger id="case-stage" className="h-9 w-full text-[13px]">
                    <SelectValue>{t(statusKey[active.status])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s} className="text-[13px]">
                        {t(statusKey[s])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <Button nativeButton={false} variant="outline" size="sm" className="h-9" render={<Link href="/dashboard/inbox" />}>
                <MessageSquareText aria-hidden />
                {t('demoOpenConversation')}
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="mt-6">
        <DocumentRequestsCard cases={query.data ?? []} />
      </div>
    </div>
  );
}
