'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { DemoPage } from '@/components/demo/demo-context';
import { WhatsappGlyph } from '@/components/matter-frame';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/workspace/panel';
import { FIRM, WHATSAPP } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export function WhatsappView() {
  const { t } = useLanguage();
  const [lastHook, setLastHook] = useState(2);

  // Webhook heartbeat: the console should feel connected, because it is.
  useEffect(() => {
    const id = window.setInterval(() => setLastHook((s) => (s >= 9 ? 1 : s + 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const max = Math.max(...WHATSAPP.throughput24h, 1);

  return (
    <DemoPage>
      <PageHeader eyebrow={`${WHATSAPP.transport} · ${FIRM.instance}`} title={t('demoWaTitle')} description={t('demoWaLede')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel bodyClassName="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#25d366]/12 text-[#128c4a] ring-1 ring-[#25d366]/30 dark:text-[#3fe07f]">
              <WhatsappGlyph className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <Signal level="ok">{t('demoConnected')}</Signal>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums">{FIRM.whatsapp}</p>
              <Docket items={[FIRM.name, t('demoWaBusiness')]} />
            </div>
            <Button variant="outline" size="sm" className="h-8">
              <RefreshCw aria-hidden />
              {t('demoWaReconnect')}
            </Button>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-4">
            {[
              [t('demoWaLastHook'), `${lastHook}s`],
              [t('demoWaInbound'), WHATSAPP.inboundToday],
              [t('demoWaOutbound'), WHATSAPP.outboundToday],
              [t('demoWaWindows'), WHATSAPP.openWindows],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-card p-3">
                <dt className="docket text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-mono text-lg font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <p className="docket mb-2 flex justify-between text-muted-foreground">
              {t('demoWaThroughput')}
              <span>00 — 23</span>
            </p>
            <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={t('demoWaThroughput')}>
              {WHATSAPP.throughput24h.map((v, i) => (
                <span
                  key={i}
                  className={cn('flex-1 rounded-t-sm', i === 10 ? 'bg-primary' : 'bg-primary/35')}
                  style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4">
          <Panel title={t('demoWaTemplates')} meta={t('demoWaTemplatesMeta')} bodyClassName="divide-y divide-border">
            {WHATSAPP.templates.map((tpl) => (
              <div key={tpl.name} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]">{tpl.name}</p>
                  <Docket items={[tpl.language, `${tpl.sent7d} ${t('demoSent7d')}`]} />
                </div>
                <Signal level={tpl.status === 'APPROVED' ? 'ok' : 'attention'}>
                  {tpl.status === 'APPROVED' ? t('kbApproved') : t('demoMetaReview')}
                </Signal>
              </div>
            ))}
          </Panel>
          <Panel title={t('demoWaRules')} bodyClassName="space-y-3 p-4 text-[13px]">
            {[t('lpSec24h'), t('demoWaRuleDisclose'), t('demoWaRuleEscalate')].map((rule) => (
              <p key={rule} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {rule}
              </p>
            ))}
          </Panel>
        </div>
      </div>
    </DemoPage>
  );
}
