'use client';

import { CalendarCheck2, Gavel, Users } from 'lucide-react';
import { DemoPage, useDemo } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, signalRule } from '@/components/signal';
import { HEARINGS, TODAY_INDEX, WEEK_DAYS, type DemoHearing } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

const kindIcon = { Hearing: Gavel, Consultation: Users, Filing: CalendarCheck2 } as const;

function Entry({ h, onOpen }: { h: DemoHearing; onOpen: () => void }) {
  const Icon = kindIcon[h.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'relative w-full rounded-lg bg-card px-3 py-2.5 text-start ring-1 ring-border transition-colors hover:bg-muted/40',
        'before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full',
        signalRule(h.level),
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-medium tabular-nums">{h.time}</span>
        <Icon className="size-3.5 text-muted-foreground" aria-label={h.kind} />
      </span>
      <span className="mt-1 block text-[13px] font-medium leading-snug">{h.title}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {h.court}
        {h.bench ? ` · ${h.bench}` : ''}
      </span>
      <Docket className="mt-1.5" items={[h.caseRef, h.lawyer.split(' ')[0]]} />
    </button>
  );
}

export function CalendarView() {
  const { t } = useLanguage();
  const { go } = useDemo();
  const hearingsToday = HEARINGS.filter((h) => h.day === TODAY_INDEX);
  const tomorrow = HEARINGS.filter((h) => h.day === TODAY_INDEX + 1);
  const critical = tomorrow.filter((h) => h.level === 'critical' || h.level === 'urgent');

  return (
    <DemoPage>
      <PageHeader
        eyebrow={`${t('demoWeek')} 42 · 13–18 OCT`}
        title={t('demoDiaryTitle')}
        description={t('demoDiaryLede')}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-border">
          <p className="docket text-muted-foreground">{t('demoToday')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{hearingsToday.length}</p>
          <p className="text-xs text-muted-foreground">{t('demoEntriesToday')}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-border">
          <p className="docket text-muted-foreground">{t('demoTomorrow')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{tomorrow.length}</p>
          <p className="text-xs text-muted-foreground">{t('demoRemindersQueued')}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-critical/30">
          <Signal level="critical">{t('demoNeedsPrep')}</Signal>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{critical.length}</p>
          <p className="truncate text-xs text-muted-foreground">{critical.map((h) => h.caseRef).join(' · ')}</p>
        </div>
      </div>

      {/* Desktop week grid */}
      <div className="hidden grid-cols-6 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border lg:grid">
        {WEEK_DAYS.map((day, i) => {
          const entries = HEARINGS.filter((h) => h.day === i);
          const today = i === TODAY_INDEX;
          return (
            <section key={day} aria-label={day} className={cn('min-h-[420px] p-2', today ? 'bg-accent/40' : 'bg-sunken')}>
              <header className="mb-2 flex items-center justify-between px-1">
                <span className={cn('docket', today ? 'text-primary' : 'text-muted-foreground')}>{day}</span>
                {today ? <span className="docket rounded bg-primary px-1.5 text-primary-foreground">{t('demoToday')}</span> : null}
              </header>
              <div className="space-y-2">
                {entries.map((h, k) => (
                  <Entry key={k} h={h} onOpen={() => go('cases', { caseRef: h.caseRef })} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Mobile / tablet agenda */}
      <div className="space-y-5 lg:hidden">
        {WEEK_DAYS.map((day, i) => {
          const entries = HEARINGS.filter((h) => h.day === i);
          if (!entries.length) return null;
          return (
            <section key={day} aria-label={day}>
              <h2 className={cn('docket mb-2', i === TODAY_INDEX ? 'text-primary' : 'text-muted-foreground')}>
                {day}
                {i === TODAY_INDEX ? ` · ${t('demoToday')}` : ''}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {entries.map((h, k) => (
                  <Entry key={k} h={h} onOpen={() => go('cases', { caseRef: h.caseRef })} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </DemoPage>
  );
}
