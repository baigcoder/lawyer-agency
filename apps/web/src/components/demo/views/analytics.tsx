'use client';

import { DemoPage } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Meter, Panel } from '@/components/workspace/panel';
import { ANALYTICS } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/** Grouped daily bars: total enquiries (graphite) with the AI-handled share (emerald). */
function DailyBars({ total, ai }: { total: number[]; ai: number[] }) {
  const max = Math.max(...total, 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`Enquiries per day, last ${total.length} days`}>
        {total.map((v, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end">
            <span className="w-full rounded-t-[3px] bg-chart-4/70" style={{ height: `${(v / max) * 100}%` }} />
            <span className="absolute bottom-0 start-0 w-full rounded-t-[3px] bg-chart-1" style={{ height: `${((ai[i] ?? 0) / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>02 OCT</span>
        <span>15 OCT</span>
      </div>
    </div>
  );
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2.5 rounded-sm', cls)} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const { t } = useLanguage();
  const total = ANALYTICS.enquiries14d.reduce((a, b) => a + b, 0);
  const ai = ANALYTICS.aiHandled14d.reduce((a, b) => a + b, 0);
  const funnelTop = ANALYTICS.funnel[0]?.value ?? 1;

  return (
    <DemoPage>
      <PageHeader eyebrow={`${t('demoLast30')} · ${t('demoLast14')}`} title={t('analytics')} description={t('demoAnaLede')} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={t('anaQ1')} meta={`${total} ${t('anaEnquiries14')}`} action={<Legend items={[[t('anaAll'), 'bg-chart-4/70'], [t('anaAi'), 'bg-chart-1']]} />} bodyClassName="p-5">
          <DailyBars total={ANALYTICS.enquiries14d} ai={ANALYTICS.aiHandled14d} />
        </Panel>

        <Panel title={t('anaQ2')} bodyClassName="grid grid-cols-2 divide-x divide-border rtl:divide-x-reverse">
          <div className="p-5">
            <p className="docket text-muted-foreground">{t('anaFirstReply')}</p>
            <p className="mt-2 font-mono text-[2rem] font-medium leading-none tabular-nums">{ANALYTICS.medianFirstReplySec}s</p>
            <p className="mt-2 text-xs text-muted-foreground">{t('anaFirstReplyHint')}</p>
          </div>
          <div className="p-5">
            <p className="docket text-muted-foreground">{t('anaLawyerAck')}</p>
            <p className="mt-2 font-mono text-[2rem] font-medium leading-none tabular-nums">{ANALYTICS.medianLawyerAckMin}m</p>
            <p className="mt-2 text-xs text-muted-foreground">{t('anaLawyerAckHint')}</p>
          </div>
        </Panel>

        <Panel title={t('anaQ3')} meta={t('demoLast30')} bodyClassName="space-y-3.5 p-5">
          {ANALYTICS.funnel.map((step, i) => {
            const prev = ANALYTICS.funnel[i - 1]?.value;
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span>{step.label}</span>
                  <span className="font-mono tabular-nums">
                    {step.value}
                    {prev ? <span className="ms-2 text-muted-foreground">{Math.round((step.value / prev) * 100)}%</span> : null}
                  </span>
                </div>
                <Meter className="mt-1.5 h-2" value={step.value} max={funnelTop} tone={i === ANALYTICS.funnel.length - 1 ? 'primary' : 'muted'} />
              </div>
            );
          })}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{t('anaDropHint')}</p>
        </Panel>

        <Panel title={t('anaQ4')} meta="%" bodyClassName="space-y-3 p-5">
          {ANALYTICS.practice.map((p, i) => (
            <div key={p.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-[13px]">
              <span>{p.label}</span>
              <Meter value={p.value} max={ANALYTICS.practice[0]?.value ?? 1} tone={i === 0 ? 'primary' : 'muted'} className="h-2" />
              <span className="text-end font-mono tabular-nums text-muted-foreground">{p.value}</span>
            </div>
          ))}
        </Panel>

        <Panel title={t('anaQ5')} meta={t('demoLast14')} bodyClassName="p-5">
          <p className="font-mono text-[2rem] font-medium leading-none tabular-nums">
            {Math.round((ai / total) * 100)}%
            <span className="ms-2 text-sm font-normal text-muted-foreground">{t('anaByAi')}</span>
          </p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-chart-1" style={{ width: `${(ai / total) * 100}%` }} />
            <span className="flex-1 bg-chart-4/70" />
          </div>
          <Legend items={[[`${ai} ${t('anaAi')}`, 'bg-chart-1'], [`${total - ai} ${t('anaPeople')}`, 'bg-chart-4/70']]} />
          <div className="mt-5 border-t border-border pt-4">
            <p className="docket mb-2 text-muted-foreground">{t('anaLanguages')}</p>
            {ANALYTICS.languages.map((l) => (
              <div key={l.label} className="mt-1.5 grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-[13px]">
                <span>{l.label}</span>
                <Meter value={l.value} tone="muted" />
                <span className="text-end font-mono tabular-nums text-muted-foreground">{l.value}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DemoPage>
  );
}
