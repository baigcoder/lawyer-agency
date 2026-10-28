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
import { cn } from '@/lib/utils';

const SECTIONS: TranslationKey[] = [
  'setProfile',
  'setGuardrails',
  'aiSettingsTitle',
  'notificationChannels',
  'paymentReceivingDetails',
  'setBilling',
  'setSecurity',
  'setIntegrations',
];

/** Segmented choice, as in Settings → AI & automation. */
function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[12.5px] transition-colors',
            value === o.value ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1 basis-60">
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
  const [langPolicy, setLangPolicy] = useState<'mirror' | 'english_only' | 'urdu_preferred'>('mirror');
  const [tone, setTone] = useState<'friendly' | 'formal' | 'concise'>('formal');
  const [length, setLength] = useState<'short' | 'balanced' | 'detailed'>('short');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [voiceMode, setVoiceMode] = useState<'auto' | 'voice_only' | 'text_only'>('auto');
  const [guards, setGuards] = useState({ neverInvent: true, firmScope: true, mentionFee: true, clarify: true });
  const [notif, setNotif] = useState({ dashboard: true, push: true, digest: false, whatsapp: true });

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
              <Docket items={[FIRM.city]} />
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

          <Panel id="aiSettingsTitle" title={t('aiSettingsTitle')} bodyClassName="divide-y divide-border">
            <Row title={t('aiLanguagePolicy')}>
              <Choice
                label={t('aiLanguagePolicy')}
                value={langPolicy}
                onChange={setLangPolicy}
                options={[
                  { value: 'mirror', label: t('aiLanguageMirror') },
                  { value: 'english_only', label: t('aiLanguageEnglish') },
                  { value: 'urdu_preferred', label: t('aiLanguageUrduPreferred') },
                ]}
              />
            </Row>
            <Row title={t('aiToneLabel')}>
              <Choice
                label={t('aiToneLabel')}
                value={tone}
                onChange={setTone}
                options={[
                  { value: 'friendly', label: t('aiToneFriendly') },
                  { value: 'formal', label: t('aiToneFormal') },
                  { value: 'concise', label: t('aiToneConcise') },
                ]}
              />
            </Row>
            <Row title={t('aiReplyLength')}>
              <Choice
                label={t('aiReplyLength')}
                value={length}
                onChange={setLength}
                options={[
                  { value: 'short', label: t('aiReplyLengthShort') },
                  { value: 'balanced', label: t('aiReplyLengthBalanced') },
                  { value: 'detailed', label: t('aiReplyLengthDetailed') },
                ]}
              />
            </Row>
            <Row title={t('aiAssistantVoiceGender')}>
              <Choice
                label={t('aiAssistantVoiceGender')}
                value={voiceGender}
                onChange={setVoiceGender}
                options={[
                  { value: 'female', label: t('aiVoiceFemale') },
                  { value: 'male', label: t('aiVoiceMale') },
                ]}
              />
            </Row>
            <Row title={t('aiVoiceReplyModeLabel')} desc={t('aiVoiceReplyModeAutoHint')}>
              <Choice
                label={t('aiVoiceReplyModeLabel')}
                value={voiceMode}
                onChange={setVoiceMode}
                options={[
                  { value: 'auto', label: t('aiVoiceReplyModeAuto') },
                  { value: 'voice_only', label: t('aiVoiceReplyModeVoiceOnly') },
                  { value: 'text_only', label: t('aiVoiceReplyModeTextOnly') },
                ]}
              />
            </Row>
            {(
              [
                ['neverInvent', 'aiNeverInvent', 'aiNeverInventHint'],
                ['firmScope', 'aiFirmScopeOnly', 'aiFirmScopeOnlyHint'],
                ['mentionFee', 'aiMentionFee', 'aiMentionFeeHint'],
                ['clarify', 'aiAskClarifying', 'aiAskClarifyingHint'],
              ] as const
            ).map(([key, title, hint]) => (
              <Row key={key} title={t(title)} desc={t(hint)}>
                <Switch checked={guards[key]} onCheckedChange={(v) => setGuards((g) => ({ ...g, [key]: v }))} aria-label={t(title)} />
              </Row>
            ))}
          </Panel>

          <Panel id="notificationChannels" title={t('notificationChannels')} bodyClassName="divide-y divide-border">
            {(
              [
                ['dashboard', 'notifDashboard', 'notifDashboardDesc'],
                ['push', 'notifWebPush', 'notifWebPushDesc'],
                ['digest', 'notifEmailDigest', 'notifEmailDigestDesc'],
                ['whatsapp', 'notifWhatsapp', 'notifWhatsappDesc'],
              ] as const
            ).map(([key, title, desc]) => (
              <Row key={key} title={t(title)} desc={t(desc)}>
                <Switch checked={notif[key]} onCheckedChange={(v) => setNotif((n) => ({ ...n, [key]: v }))} aria-label={t(title)} />
              </Row>
            ))}
          </Panel>

          <Panel
            id="paymentReceivingDetails"
            title={t('paymentReceivingDetails')}
            meta={t('paymentReceivingDetailsSettingsHint')}
            bodyClassName="divide-y divide-border"
          >
            {[
              ['JazzCash', `0300 •••• 412 · ${FIRM.name}`],
              ['Easypaisa', `0345 •••• 118 · ${FIRM.name}`],
              ['Bank transfer', 'Meezan Bank · PK•• MEZN •••• 7731'],
            ].map(([name, detail]) => (
              <Row key={name} title={String(name)} desc={String(detail)}>
                <Signal level="ok">{t('setOn')}</Signal>
              </Row>
            ))}
          </Panel>

          <Panel id="setBilling" title={t('setBilling')} bodyClassName="divide-y divide-border">
            <Row title={t('setPlanName')} desc={t('setPlanDesc')}>
              <Signal level="info">{t('setPlanPilot')}</Signal>
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
              ['Document storage', 'Supabase Storage', true],
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

