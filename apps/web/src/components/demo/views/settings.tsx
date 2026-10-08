'use client';

import { useState } from 'react';
import { Lock, Scale } from 'lucide-react';
import { DemoPage } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal } from '@/components/signal';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/workspace/panel';
import { FIRM } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';

const SECTIONS: TranslationKey[] = ['setProfile', 'setGuardrails', 'setBilling', 'setSecurity', 'setIntegrations'];

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{title}</p>
        {desc ? <p className="mt-0.5 text-[13px] leading-6 text-muted-foreground">{desc}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const { t } = useLanguage();
  const [autoFaq, setAutoFaq] = useState(true);
  const [afterHours, setAfterHours] = useState(true);
  const [voice, setVoice] = useState(true);

  const locked = (
    <span className="flex items-center gap-2">
      <Lock className="size-3.5 text-muted-foreground" aria-hidden />
      <Switch checked disabled aria-label={t('setLocked')} />
    </span>
  );

  return (
    <DemoPage>
      <PageHeader eyebrow={FIRM.name} title={t('settings')} description={t('demoSetLede')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={t('settings')} className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start">
          {SECTIONS.map((s) => (
            <a key={s} href={`#${s}`} className="shrink-0 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {t(s)}
            </a>
          ))}
        </nav>

        <div className="max-w-3xl space-y-6">
          <div className="flex gap-3 rounded-xl border-s-[3px] border-attention bg-attention/[0.07] p-4">
            <Scale className="mt-0.5 size-5 shrink-0 text-attention" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t('setNoticeTitle')}</p>
              <p className="mt-1 text-[13.5px] leading-6 text-foreground/85">{t('setNoticeBody')}</p>
            </div>
          </div>

          <Panel id="setProfile" title={t('setProfile')} bodyClassName="divide-y divide-border">
            <Row title={FIRM.name} desc={`${FIRM.city} · Criminal, Family, Property, Civil, Revenue, Corporate`}>
              <Docket items={['LHC', 'LHCBA']} />
            </Row>
            <Row title={t('setHours')} desc="Mon–Fri 09:00–18:00 · Sat 10:00–14:00 · PKT">
              <span />
            </Row>
          </Panel>

          <Panel id="setGuardrails" title={t('setGuardrails')} meta={t('setGuardrailsMeta')} bodyClassName="divide-y divide-border">
            <Row title={t('setAutoFaq')} desc={t('setAutoFaqDesc')}>
              <Switch checked={autoFaq} onCheckedChange={setAutoFaq} aria-label={t('setAutoFaq')} />
            </Row>
            <Row title={t('setAfterHours')} desc={t('setAfterHoursDesc')}>
              <Switch checked={afterHours} onCheckedChange={setAfterHours} aria-label={t('setAfterHours')} />
            </Row>
            <Row title={t('setVoice')} desc={t('setVoiceDesc')}>
              <Switch checked={voice} onCheckedChange={setVoice} aria-label={t('setVoice')} />
            </Row>
            <Row title={t('lpRule1T')} desc={t('lpRule1D')}>{locked}</Row>
            <Row title={t('lpRule2T')} desc={t('lpRule2D')}>{locked}</Row>
            <Row title={t('setDisclose')} desc={t('demoWaRuleDisclose')}>{locked}</Row>
          </Panel>

          <Panel id="setBilling" title={t('setBilling')} bodyClassName="divide-y divide-border">
            <Row title="Chambers plan" desc={t('setPlanDesc')}>
              <span className="font-mono text-sm tabular-nums">PKR 18,000 / mo</span>
            </Row>
          </Panel>

          <Panel id="setSecurity" title={t('setSecurity')} bodyClassName="divide-y divide-border">
            <Row title={t('setRls')} desc={t('lpSecRls')}>
              <Signal level="ok">{t('setEnforced')}</Signal>
            </Row>
            <Row title={t('setT3')} desc={t('lpT3Rule')}>{locked}</Row>
            <Row title={t('setAudit')} desc={t('lpSecAudit')}>
              <Signal level="ok">{t('setOn')}</Signal>
            </Row>
          </Panel>

          <Panel id="setIntegrations" title={t('setIntegrations')} bodyClassName="divide-y divide-border">
            {[
              ['WhatsApp · Evolution API', FIRM.whatsapp, true],
              ['Google Calendar', 'diary@almadadlaw.pk', true],
              ['Document storage', 'Encrypted · per-firm bucket', true],
            ].map(([name, detail, on]) => (
              <Row key={String(name)} title={String(name)} desc={String(detail)}>
                <Signal level={on ? 'ok' : 'info'}>{t('demoConnected')}</Signal>
              </Row>
            ))}
          </Panel>
        </div>
      </div>
    </DemoPage>
  );
}

