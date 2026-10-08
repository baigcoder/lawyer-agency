'use client';

import { Bot, CalendarDays } from 'lucide-react';
import { AttentionRow } from '@/components/attention-row';
import { useDemo, DemoPage } from '@/components/demo/demo-context';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Meter, Panel } from '@/components/workspace/panel';
import { SlaClock } from '@/components/workspace/sla-clock';
import { ANALYTICS, HEARINGS, TODAY_INDEX, formatPkr } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export function OverviewView() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const { go, conversations, escalations, payments, activity } = useDemo();

  const critical = escalations.filter((e) => e.status === 'OPEN');
  const waiting = conversations.filter((c) => c.state === 'HUMAN_REQUIRED');
  const drafts = conversations.filter((c) => c.draft).length;
  const today = HEARINGS.filter((h) => h.day === TODAY_INDEX);
  const tomorrow = HEARINGS.filter((h) => h.day === TODAY_INDEX + 1);
  const aiTotal = ANALYTICS.aiHandled14d.slice(-7).reduce((a, b) => a + b, 0);
  const allTotal = ANALYTICS.enquiries14d.slice(-7).reduce((a, b) => a + b, 0);
  const pendingProof = payments.filter((p) => p.status === 'PENDING');
  const overdue = payments.filter((p) => p.overdue && p.status === 'REQUESTED');
  const collected = payments.filter((p) => p.status === 'SUCCEEDED' || p.status === 'RECORDED_MANUAL');

  return (
    <DemoPage>
      <PageHeader
        eyebrow={<>WED 15 OCT · LAHORE · 08:52</>}
        title={`${t('goodMorning')}, Saad`}
        description={t('demoOverviewLede')}
        action={
          <Button variant="outline" size="sm" className="h-8" onClick={() => go('inbox')}>
            {t('openFullInbox')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard title={t('demoMetricCritical')} value={critical.length} signal="critical" detail={<Docket items={critical.map((e) => e.caseRef)} />} onClick={() => go('escalations')} />
        <MetricCard title={t('demoMetricWaiting')} value={waiting.length} signal="attention" detail={`${drafts} ${t('demoDraftsAwaiting')}`} onClick={() => go('inbox')} />
        <MetricCard title={t('demoMetricHearings')} value={today.filter((h) => h.kind === 'Hearing').length} signal="routine" detail={`${tomorrow.length} ${t('demoTomorrow')}`} onClick={() => go('calendar')} />
        <MetricCard title={t('aiHandledWeek')} value={`${Math.round((aiTotal / allTotal) * 100)}%`} signal="ok" detail={`${aiTotal} / ${allTotal}`} spark={ANALYTICS.aiHandled14d} onClick={() => go('analytics')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel title={t('needsAttentionNow')} meta={`${critical.length + waiting.length + overdue.length + pendingProof.length} ${t('demoItems')}`} bodyClassName="p-2">
          {critical.map((e) => (
            <AttentionRow
              key={e.id}
              level={e.trigger === 'IMMINENT_DEADLINE' ? 'urgent' : 'critical'}
              onClick={() => go('escalations', { escalation: e.id })}
              title={`${e.client} — ${t(`escTrigger${e.trigger}`)}`}
              meta={<Docket items={[e.caseRef, e.assignee ?? t('demoUnassigned')]} />}
              trailing={e.deadline ? <SlaClock deadline={e.deadline} /> : null}
            />
          ))}
          {waiting
            .filter((c) => !critical.some((e) => e.caseRef === c.caseRef))
            .map((c) => (
              <AttentionRow
                  key={c.id}
                  onClick={() => go('inbox', { conversation: c.id })}
                  level="attention"
                  title={`${c.client} — ${c.matter}`}
                  meta={<Docket items={[c.caseRef, c.assignee, c.paymentProof ? 'Fee proof' : null]} />}
                  trailing={<span className="docket text-muted-foreground">{c.time}</span>}
                />
            ))}
          {pendingProof.map((p) => (
            <AttentionRow
                key={p.id}
                onClick={() => go('payments')}
                level="attention"
                title={`${formatPkr(p.amountPkr)} ${t('demoProofToVerify')} — ${p.client}`}
                meta={<Docket items={[p.caseRef, p.method]} />}
              />
          ))}
          {overdue.map((p) => (
            <AttentionRow
                key={p.id}
                onClick={() => go('payments')}
                level="routine"
                title={`${formatPkr(p.amountPkr)} ${t('demoOverdueFrom')} ${p.client}`}
                meta={<Docket items={[p.caseRef, `${t('demoRequested')} ${p.date}`]} />}
              />
          ))}
        </Panel>

        <div className="grid grid-cols-1 gap-4">
          <Panel
            title={t('demoDiary')}
            meta={t('demoTodayTomorrow')}
            action={
              <Button variant="ghost" size="icon-sm" aria-label={t('calendar')} onClick={() => go('calendar')}>
                <CalendarDays aria-hidden />
              </Button>
            }
            bodyClassName="divide-y divide-border"
          >
            {[...today, ...tomorrow].map((h, i) => (
              <button
                key={`${h.caseRef}-${h.time}-${i}`}
                type="button"
                onClick={() => go('cases', { caseRef: h.caseRef })}
                className="grid w-full grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-muted/50"
              >
                <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
                  {i >= today.length ? <span className="block text-[10px] uppercase">{t('demoTmrw')}</span> : null}
                  {h.time}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{h.title}</span>
                  <Docket items={[h.caseRef, h.court]} />
                </span>
                {h.level === 'critical' || h.level === 'urgent' ? <Signal level={h.level}>{t(h.level === 'critical' ? 'sigCritical' : 'sigUrgent')}</Signal> : null}
              </button>
            ))}
          </Panel>

          <Panel title={t('demoAiActivity')} meta={t('demoAiActivityMeta')} bodyClassName="px-4 py-3">
            <ul className="space-y-2.5 text-[13px]" aria-live="polite">
              {activity.slice(0, 6).map((a) => (
                <li key={a.id} className={cn('flex gap-3', a.id === activity[0]?.id && a.time === 'now' && 'row-arrive')}>
                  <Bot className={cn('mt-0.5 size-3.5 shrink-0', a.time === 'now' ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{a.what}</p>
                    <Docket items={[a.time === 'now' ? t('demoJustNow') : a.time, a.who, a.source]} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className={cn('text-muted-foreground', urdu)}>{t('demoAiVsPeople')}</span>
                <span className="font-mono tabular-nums">{aiTotal} / {allTotal - aiTotal}</span>
              </div>
              <Meter className="mt-2" value={aiTotal} max={allTotal} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('demoPipeline')} meta={t('demoLast30')} bodyClassName="px-4 py-4">
          <ol className="grid grid-cols-4 gap-2">
            {ANALYTICS.funnel.map((step, i) => (
              <li key={step.label}>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{step.value}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.label}</p>
                <Meter className="mt-2" value={step.value} max={ANALYTICS.funnel[0]?.value ?? 1} tone={i === 3 ? 'primary' : 'muted'} />
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={t('payments')} meta={t('demoLast30')} bodyClassName="grid grid-cols-3 divide-x divide-border rtl:divide-x-reverse">
          {[
            [t('demoCollected'), collected.reduce((a, p) => a + p.amountPkr, 0), 'text-foreground'],
            [t('demoPending'), pendingProof.reduce((a, p) => a + p.amountPkr, 0), 'text-attention'],
            [t('demoOverdue'), overdue.reduce((a, p) => a + p.amountPkr, 0), 'text-critical'],
          ].map(([label, amount, tone]) => (
            <button key={String(label)} type="button" onClick={() => go('payments')} className="px-4 py-4 text-start transition-colors hover:bg-muted/40">
              <p className="docket text-muted-foreground">{label}</p>
              <p className={cn('mt-1.5 font-mono text-lg font-medium tabular-nums', String(tone))}>{formatPkr(Number(amount))}</p>
            </button>
          ))}
        </Panel>
      </div>
    </DemoPage>
  );
}
