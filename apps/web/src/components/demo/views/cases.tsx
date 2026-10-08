'use client';

import { useMemo, useState } from 'react';
import { FileText, MessageSquareText, X } from 'lucide-react';
import { DemoPage, useDemo } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, SignalDot, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Meter, Panel } from '@/components/workspace/panel';
import { CASES, formatPkr, type DemoCase } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

export const caseStatusKey: Record<DemoCase['status'], TranslationKey> = {
  LEAD: 'caseStatusLEAD',
  CONSULTATION: 'caseStatusCONSULTATION',
  ENGAGED: 'caseStatusENGAGED',
  IN_COURT: 'caseStatusIN_COURT',
  CLOSED: 'caseStatusCLOSED',
  ARCHIVED: 'caseStatusARCHIVED',
};

export function urgencyLevel(u: DemoCase['urgency']): SignalLevel {
  return u === 'CRITICAL' ? 'critical' : u === 'HIGH' ? 'urgent' : u === 'NORMAL' ? 'routine' : 'info';
}

type Filter = 'all' | 'IN_COURT' | 'ENGAGED' | 'LEAD' | 'CLOSED';

export function CasesView() {
  const { t } = useLanguage();
  const { focusCase, setFocusCase } = useDemo();
  const [filter, setFilter] = useState<Filter>('all');
  const rows = useMemo(() => CASES.filter((c) => filter === 'all' || c.status === filter), [filter]);
  const active = CASES.find((c) => c.reference === focusCase) ?? null;
  // With a dossier open beside it, the register drops forum and lawyer.
  const cols = active
    ? 'lg:grid-cols-[6.5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_7rem_8.5rem_7rem] xl:grid-cols-[6.5rem_minmax(0,1fr)_7rem_8.5rem]'
    : 'lg:grid-cols-[6.5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_7rem_8.5rem_7rem]';
  const wide = active ? 'xl:hidden' : '';

  const filters: Array<{ value: Filter; label: string; count: number }> = [
    { value: 'all', label: t('demoAllMatters'), count: CASES.length },
    { value: 'IN_COURT', label: t('caseStatusIN_COURT'), count: CASES.filter((c) => c.status === 'IN_COURT').length },
    { value: 'ENGAGED', label: t('caseStatusENGAGED'), count: CASES.filter((c) => c.status === 'ENGAGED').length },
    { value: 'LEAD', label: t('caseStatusLEAD'), count: CASES.filter((c) => c.status === 'LEAD').length },
    { value: 'CLOSED', label: t('caseStatusCLOSED'), count: CASES.filter((c) => c.status === 'CLOSED').length },
  ];

  return (
    <DemoPage>
      <PageHeader eyebrow={`${CASES.filter((c) => c.status !== 'CLOSED').length} ${t('demoOpenMatters')}`} title={t('cases')} description={t('demoCasesLede')} />

      <div role="tablist" aria-label={t('cases')} className="mb-4 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {filters.map((f) => (
          <button
            key={f.value}
            role="tab"
            type="button"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              filter === f.value ? 'bg-card font-medium shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {f.label}
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{f.count}</span>
          </button>
        ))}
      </div>

      <div className={cn('grid grid-cols-1 gap-4', active && 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
        <Panel bodyClassName="divide-y divide-border">
          <div className={cn('hidden gap-4 bg-sunken/70 px-4 py-2 lg:grid', cols)}>
            {[t('tlRef'), t('mfMatter'), t('tlForum'), t('demoStatus'), t('mfNextDate'), t('tlLawyer')].map((h, i) => (
              <span key={h} className={cn('docket text-muted-foreground', (i === 2 || i === 5) && wide)}>{h}</span>
            ))}
          </div>
          {rows.map((c) => {
            const selected = c.reference === focusCase;
            return (
              <button
                key={c.reference}
                type="button"
                onClick={() => setFocusCase(selected ? null : c.reference)}
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
                  <span className="block truncate text-[13.5px] font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.client} · {c.practice}</span>
                </span>
                <span className={cn('truncate text-[13px] text-muted-foreground max-lg:hidden', wide)}>{c.forum}</span>
                <span className="max-lg:hidden">
                  <span className="docket text-foreground/80">{t(caseStatusKey[c.status])}</span>
                </span>
                <span className={cn('font-mono text-[12.5px] tabular-nums max-lg:hidden', c.nextDate?.startsWith('Tomorrow') || c.nextDate?.startsWith('Today') ? 'text-foreground' : 'text-muted-foreground')}>
                  {c.nextDate ?? '—'}
                </span>
                <span className={cn('truncate text-[13px] max-lg:hidden', wide)}>{c.lawyer}</span>
                <Docket className="lg:hidden" items={[t(caseStatusKey[c.status]), c.nextDate, c.lawyer]} />
              </button>
            );
          })}
        </Panel>

        {active ? <Dossier matter={active} onClose={() => setFocusCase(null)} /> : null}
      </div>
    </DemoPage>
  );
}

function Dossier({ matter: m, onClose }: { matter: DemoCase; onClose: () => void }) {
  const { t } = useLanguage();
  const { go, conversations } = useDemo();
  const outstanding = m.billedPkr - m.collectedPkr;
  const conv = conversations.find((c) => c.caseRef === m.reference);

  return (
    <aside
      aria-label={`${t('demoDossier')} ${m.reference}`}
      className="reveal-in fixed inset-0 z-50 overflow-y-auto bg-background xl:sticky xl:inset-auto xl:top-20 xl:z-auto xl:max-h-[calc(100svh-7rem)] xl:rounded-xl xl:bg-card xl:ring-1 xl:ring-border"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-inherit px-5 py-3 backdrop-blur">
        <Docket items={[t('demoDossier'), m.reference, m.practice]} />
        <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <Signal level={urgencyLevel(m.urgency)}>{t(caseStatusKey[m.status])} · {m.urgency}</Signal>
          <h2 className="mt-2 font-display text-[1.75rem] leading-[1.1]">{m.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{m.client}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          {[
            [t('tlForum'), m.forum],
            [t('mfNextDate'), m.nextDate ?? '—'],
            [t('tlLawyer'), m.lawyer],
            [t('demoOpened'), m.opened],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="docket text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="docket mb-3 text-muted-foreground">{t('demoTimeline')}</h3>
          {m.timeline.length ? (
            <ol className="relative space-y-3 border-s border-border ps-4">
              {m.timeline.map((ev, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={cn('absolute -start-[21px] top-1.5 size-2 rounded-full ring-4 ring-card', i === 0 ? 'bg-primary' : 'bg-muted-foreground/40')} />
                  <p className="text-[13px]">{ev.text}</p>
                  <Docket items={[ev.time, ev.who]} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t('demoNoActivity')}</p>
          )}
        </section>

        <section className="rounded-lg bg-sunken p-4 ring-1 ring-border">
          <h3 className="docket mb-3 text-muted-foreground">{t('demoBilling')}</h3>
          <dl className="grid grid-cols-3 gap-3">
            {[
              [t('demoBilled'), m.billedPkr, ''],
              [t('demoCollected'), m.collectedPkr, ''],
              [t('demoOutstanding'), outstanding, outstanding > 0 ? 'text-attention' : 'text-muted-foreground'],
            ].map(([k, v, tone]) => (
              <div key={String(k)}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className={cn('mt-0.5 font-mono text-[13px] font-medium tabular-nums', String(tone))}>{formatPkr(Number(v))}</dd>
              </div>
            ))}
          </dl>
          <Meter className="mt-3" value={m.collectedPkr} max={Math.max(m.billedPkr, 1)} />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => go('documents')}>
            <FileText aria-hidden />
            {m.documents} {t('documents')}
          </Button>
          {conv ? (
            <Button variant="outline" size="sm" className="h-9" onClick={() => go('inbox', { conversation: conv.id })}>
              <MessageSquareText aria-hidden />
              {t('demoOpenConversation')}
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
