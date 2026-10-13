'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock,
  FileCheck,
  FileText,
  ImageIcon,
  Lock,
  Mic,
  Phone,
  PhoneMissed,
  Play,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ApprovalGate } from '@/components/approval-gate';
import { AttentionRow } from '@/components/attention-row';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Section, SectionHeading } from '@/components/marketing-section';
import { FilmPlayer } from '@/components/film-player';
import { DEMO_MATTER, MatterFrame, WhatsappGlyph } from '@/components/matter-frame';
import { Docket, Signal } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { DEMO_BRIEF } from '@/lib/demo-data';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

const FAQ = [
  ['faqQ1', 'faqA1'],
  ['faqQ2', 'faqA2'],
  ['faqQ3', 'faqA3'],
  ['faqQ4', 'faqA4'],
  ['faqQ5', 'faqA5'],
  ['faqQ6', 'faqA6'],
] as const;

export default function Home() {
  const { t, dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const urdu = isRtl ? 'font-urdu' : undefined;

  return (
    <div className="min-h-svh bg-background text-foreground" dir={dir}>
      <MarketingHeader />

      <main id="main">
        <Hero />

        {/* ── The film ────────────────────────────────────────────────── */}
        <Section id="film" tone="stage" labelledBy="film-title" size="sm" innerClassName="py-16 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading id="film-title" eyebrow={t('filmEyebrow')} title={t('filmTitle')} urdu={isRtl} className="max-w-xl" />
              <p className={cn('max-w-sm text-[0.95rem] leading-7 text-muted-foreground', urdu)}>{t('filmLede')}</p>
            </div>
            <FilmPlayer src="/video/wakeel-film.mp4" poster="/video/wakeel-film-poster.jpg" />
          </div>
        </Section>

        {/* ── ACT 01 · The front door ─────────────────────────────────── */}
        <Section id="front-door" labelledBy="act1-title">
          <SectionHeading
            id="act1-title"
            index="01"
            eyebrow={t('lpAct1Label')}
            title={t('lpAct1Title')}
            urdu={isRtl}
            align="center"
            className="max-w-4xl"
          />
          <InboundStrip />
          <p className={cn('mx-auto mt-10 max-w-xl text-center text-[1.0625rem] leading-8 text-muted-foreground', urdu)}>
            {t('lpAct1Foot')}
          </p>
        </Section>

        {/* ── ACT 02 · Matter formation (signature) ───────────────────── */}
        <Section id="formation" tone="muted" labelledBy="act2-title">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
            <SectionHeading id="act2-title" index="02" eyebrow={t('lpAct2Label')} title={t('lpAct2Title')} urdu={isRtl} />
            <p className={cn('max-w-md text-[1.0625rem] leading-8 text-muted-foreground lg:justify-self-end', urdu)}>
              {t('lpAct2Lede')}
            </p>
          </div>
          <FormationRail />
        </Section>

        {/* ── ACT 03 · Controlled intelligence ────────────────────────── */}
        <Section id="intelligence" labelledBy="act3-title" innerClassName="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <SectionHeading id="act3-title" index="03" eyebrow={t('lpAct3Label')} title={t('lpAct3Title')} urdu={isRtl} />
            <ol className="mt-10 divide-y divide-border border-y border-border">
              {[
                [t('whatIsWakeelPoint2Title'), t('whatIsWakeelPoint2Desc')],
                [t('feature3Title'), t('feature3Desc')],
                [t('feature2Title'), t('feature2Desc')],
              ].map(([title, desc], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 py-5">
                  <span className="docket pt-1 text-primary">0{i + 1}</span>
                  <div>
                    <h3 className={cn('font-semibold', urdu)}>{title}</h3>
                    <p className={cn('mt-1.5 text-sm leading-6 text-muted-foreground', urdu)}>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <IntelligenceProof />
        </Section>

        {/* ── Voice receptionist (D-124) ──────────────────────────────── */}
        <Section id="voice" tone="muted" labelledBy="voice-title" innerClassName="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="lg:order-2">
            <SectionHeading id="voice-title" eyebrow={t('overviewAiTakesCalls')} title={t('voiceTitle')} lede={t('voiceDesc')} urdu={isRtl} />
            <ul className="mt-8 space-y-3">
              {[t('voicePoint1'), t('voicePoint2'), t('voicePoint3'), t('voicePoint4')].map((point) => (
                <li key={point} className={cn('flex gap-3 text-sm leading-6', urdu)}>
                  <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <VoiceCallCard />
        </Section>

        {/* ── ACT 04 · The handoff ────────────────────────────────────── */}
        <Section id="handoff" labelledBy="act4-title" innerClassName="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="act4-title" index="04" eyebrow={t('lpAct4Label')} title={t('lpAct4Title')} lede={t('lpAct4Lede')} urdu={isRtl} />
          </div>
          <HandoffFrame />
        </Section>

        {/* ── ACT 05 · The command center ─────────────────────────────── */}
        <Section id="command" tone="stage" labelledBy="act5-title">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <SectionHeading id="act5-title" index="05" eyebrow={t('lpAct5Label')} title={t('lpAct5Title')} lede={t('lpAct5Lede')} urdu={isRtl} />
            <Button variant="outline" size="lg" className="h-11 px-5" nativeButton={false} render={<Link href="/demo" />}>
              <span className={urdu}>{t('lpOpenWalkthrough')}</span>
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Button>
          </div>
          <CommandPreview />
        </Section>

        {/* ── ACT 06 · Human control ──────────────────────────────────── */}
        <Section id="control" labelledBy="act6-title" size="lg">
          <div className="text-center">
            <p className="docket text-primary">
              <span className="text-muted-foreground">06 · </span>
              {t('lpAct6Label')}
            </p>
            <h2
              id="act6-title"
              className={cn(
                'mx-auto mt-5 max-w-4xl text-balance',
                isRtl ? 'font-urdu text-4xl leading-[1.7] sm:text-5xl sm:leading-[1.7]' : 'font-display text-5xl leading-[1] sm:text-7xl',
              )}
            >
              {t('lpAct6Title1')}{' '}
              <span className={cn('text-primary', !isRtl && 'italic')}>{t('lpAct6Title2')}</span>
            </h2>
          </div>
          <div className="mx-auto mt-14 max-w-xl">
            <ApprovalGate demo meta={`${DEMO_MATTER.reference} · ${t('mfToClient')}`}>
              <span dir="ltr" className="block text-start">{DEMO_MATTER.thread.draft}</span>
            </ApprovalGate>
            <ol className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {[
                ['23:46', t('lpAudit1')],
                ['23:51', `${t('lpAudit2')} · ${DEMO_MATTER.lawyer}`],
                ['23:51', t('lpAudit3')],
              ].map(([time, label], i) => (
                <li key={label} className="flex items-center gap-3">
                  {i > 0 ? <span aria-hidden className="h-px w-4 bg-border" /> : null}
                  <Docket items={[time, label]} />
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-16">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-3">
              <span className="docket text-primary font-semibold">The Three Chambers Covenants</span>
              <span className="docket text-muted-foreground">Constitutional AI Boundaries · Firm Enforced</span>
            </div>
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  covenant: 'Covenant 01',
                  badge: 'Human Sign-off',
                  title: t('lpRule1T'),
                  desc: t('lpRule1D'),
                  detail: 'Strict Meta 24h & firm guardrails — no unapproved messages leave the chambers.',
                },
                {
                  covenant: 'Covenant 02',
                  badge: 'Statutory Bypass',
                  title: t('lpRule2T'),
                  desc: t('lpRule2D'),
                  detail: 'Immediate escalation to designated associate — automation completely stops.',
                },
                {
                  covenant: 'Covenant 03',
                  badge: 'Cryptographic Audit',
                  title: t('lpRule3T'),
                  desc: t('lpRule3D'),
                  detail: 'Immutable log of drafts, approvals, edits, and sends with user IDs and timestamps.',
                },
              ].map((item, i) => (
                <li key={item.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="docket text-primary">0{i + 1} · {item.covenant}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className={cn('mt-3 text-base font-semibold', urdu)}>{item.title}</h3>
                  <p className={cn('mt-2 text-sm leading-relaxed text-muted-foreground', urdu)}>{item.desc}</p>
                  <p className="mt-4 border-t border-dashed border-border/80 pt-3 font-mono text-[11px] text-foreground/75 font-medium">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        {/* ── ACT 07 · Security ───────────────────────────────────────── */}
        <Section id="security" tone="muted" labelledBy="act7-title" innerClassName="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div>
            <SectionHeading id="act7-title" index="07" eyebrow={t('security')} title={t('lpAct7Title')} lede={t('lpAct7Lede')} urdu={isRtl} />
            <ul className="mt-10 space-y-4">
              {[t('securityPoint4'), t('securityPoint1'), t('securityPoint2'), t('securityPoint3')].map((point) => (
                <li key={point} className={cn('flex gap-3 text-sm leading-6', urdu)}>
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <TierLedger />
        </Section>

        {/* ── FAQ — the objections, answered ──────────────────────────── */}
        <Section id="faq" labelledBy="faq-title" innerClassName="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <SectionHeading id="faq-title" eyebrow={t('faqLabel')} title={t('faqTitle')} urdu={isRtl} />
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-start [&::-webkit-details-marker]:hidden">
                  <span className={cn('text-[1.05rem] font-semibold', urdu)}>{t(q)}</span>
                  <Plus className="size-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className={cn('max-w-2xl pb-5 text-[0.95rem] leading-7 text-muted-foreground', urdu)}>{t(a)}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* ── ACT 08 · Closing ────────────────────────────────────────── */}
        <Section tone="stage" size="lg" labelledBy="final-title">
          <div className="mx-auto max-w-3xl text-center">
            <WakeelSeal />
            <h2
              id="final-title"
              className={cn(
                'mt-8 text-balance',
                isRtl ? 'font-urdu text-4xl leading-[1.7]' : 'font-display text-5xl leading-[1.02] sm:text-6xl',
              )}
            >
              {t('lpFinalTitle')}
            </h2>
            <p className={cn('mx-auto mt-6 max-w-xl text-[1.0625rem] leading-8 text-muted-foreground', urdu)}>{t('ctaDesc')}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-[0.95rem]" nativeButton={false} render={<Link href="/sign-up" />}>
                <span className={urdu}>{t('startPilot')}</span>
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6 text-[0.95rem]" nativeButton={false} render={<Link href="/demo" />}>
                <span className={urdu}>{t('viewDemo')}</span>
              </Button>
            </div>
            <p className={cn('mt-5 text-sm text-muted-foreground', urdu)}>{t('pilotNote')}</p>
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function Hero() {
  const { t, dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const urdu = isRtl ? 'font-urdu' : undefined;

  return (
    <section aria-labelledby="hero-title" className="relative border-b border-border">
      <div className="mx-auto grid grid-cols-1 max-w-[1400px] gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 xl:gap-16 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="reveal-in">
          <p className="docket flex items-center gap-2 text-primary">
            <WhatsappGlyph className="size-3.5" />
            {t('lpEyebrow')}
          </p>
          <h1
            id="hero-title"
            className={cn(
              'mt-6 text-balance',
              isRtl
                ? 'font-urdu text-[2.5rem] leading-[1.7] sm:text-5xl sm:leading-[1.7]'
                : 'font-display text-[3rem] leading-[1] tracking-[-0.015em] sm:text-[3.75rem] xl:text-[4.5rem]',
            )}
          >
            {t('heroTitle')}{' '}
            <span className={cn('text-primary', !isRtl && 'italic')}>{t('heroTitleAccent')}</span>
          </h1>
          <p className={cn('mt-7 max-w-[34rem] text-pretty text-[1.0625rem] leading-8 text-muted-foreground', urdu)}>
            {t('heroSubtitle')}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-6 text-[0.95rem]" nativeButton={false} render={<Link href="/sign-up" />}>
              <span className={urdu}>{t('startPilot')}</span>
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6 text-[0.95rem]" nativeButton={false} render={<Link href="/demo" />}>
              <span className={urdu}>{t('viewDemo')}</span>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/25">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>High Court & Bar Council Compliant</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/80 ring-1 ring-border">
              <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Postgres RLS · Tenant Isolated</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground/80 ring-1 ring-border">
              <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Meta Cloud WhatsApp 24/7</span>
            </span>
          </div>
          <Docket
            className="mt-6 border-t border-border pt-4"
            items={[t('lpHeroLangs'), t('lpHeroUrgent'), t('lpHeroNoAdvice')]}
          />
        </div>

        <div className="chambers-stage -mx-4 rounded-none p-4 sm:mx-0 sm:rounded-[1.25rem] sm:p-6 lg:p-8">
          <MatterFrame />
          <p className={cn('mt-4 text-center text-xs text-white/55', urdu)}>{t('illustrativeDemo')}</p>
        </div>
      </div>
    </section>
  );
}

/** ACT 01 — the messy inputs clients already send. */
/** ACT 01 — the authentic WhatsApp legal evidence artifacts. */
function InboundStrip() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <div className="mx-auto mt-14 max-w-5xl" aria-label={t('lpAct1Label')}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 01: Voice Note */}
        <li className="scroll-reveal flex flex-col justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-all hover:shadow-md">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium text-primary', urdu)}>
                <Mic className="size-3.5 text-primary" aria-hidden="true" />
                <span>{t('lpInVoice')}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">23:58</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2 rounded-lg bg-sunken p-2 ring-1 ring-border/50">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Play className="ms-0.5 size-3 fill-current" aria-hidden="true" />
                </span>
                <Waveform />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Transcript:</span> &ldquo;Bhai kal raat se police custody mein hain Cantt courts…&rdquo;
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-border/50 pt-2 text-[11px]">
            <span className="docket text-primary">Speech-to-Text · Indexed</span>
          </div>
        </li>

        {/* 02: FIR Photo */}
        <li className="scroll-reveal flex flex-col justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-all hover:shadow-md lg:translate-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium text-foreground', urdu)}>
                <ImageIcon className="size-3.5 text-[#25d366]" aria-hidden="true" />
                <span>{t('lpInPhoto')}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">23:59</span>
            </div>
            <div className="mt-3 rounded-lg border border-border/80 bg-background/90 p-2.5">
              <div className="flex items-center justify-between border-b border-dashed border-border/80 pb-1.5">
                <span className="font-mono text-xs font-semibold text-foreground">FIR 412/26</span>
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  Non-Bailable
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-foreground/80">PS Gulberg · Lahore</p>
              <p className="font-mono text-[10px] text-muted-foreground">Sec 420 / 468 / 471 PPC</p>
            </div>
          </div>
          <div className="mt-3 border-t border-border/50 pt-2 text-[11px]">
            <span className="docket text-attention">OCR Extracted · Urgent</span>
          </div>
        </li>

        {/* 03: Roman Urdu */}
        <li className="scroll-reveal flex flex-col justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-all hover:shadow-md">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <WhatsappGlyph className="size-3.5 text-[#25d366]" />
                <span>Roman Urdu</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">00:04</span>
            </div>
            <div className="mt-3">
              <div className="rounded-xl rounded-ss-sm bg-sunken p-2.5 text-[12.5px] leading-relaxed ring-1 ring-border/50">
                <p dir="ltr">&ldquo;Sir consultation fee kitni hai aur Saturday ko office open hota hai?&rdquo;</p>
                <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  <span>00:04</span>
                  <CheckCheck className="size-3 text-primary" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-border/50 pt-2 text-[11px]">
            <span className="docket text-foreground/80">Intent: Retainer Inquiry</span>
          </div>
        </li>

        {/* 04: Urdu Nastaliq */}
        <li className="scroll-reveal flex flex-col justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-all hover:shadow-md lg:translate-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <WhatsappGlyph className="size-3.5 text-[#25d366]" />
                <span className="font-urdu">اردو سائل</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">00:07</span>
            </div>
            <div className="mt-3">
              <div className="rounded-xl rounded-ss-sm bg-sunken p-2.5 text-[12.5px] ring-1 ring-border/50">
                <p dir="rtl" className="font-urdu text-[13px] leading-[2.1] text-foreground">
                  کیا آپ کل کینٹ کچہری میں ضمانت کے لیے دستیاب ہیں؟
                </p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  <span>00:07</span>
                  <CheckCheck className="size-3 text-primary" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-border/50 pt-2 text-[11px]">
            <span className="docket text-foreground/80">پیشی · کینٹ عدالت</span>
          </div>
        </li>

        {/* 05: Missed Call Auto-Triage */}
        <li className="scroll-reveal flex flex-col justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-sm transition-all hover:shadow-md">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium text-destructive', urdu)}>
                <PhoneMissed className="size-3.5" aria-hidden="true" />
                <span>{t('lpInCall')}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">00:11</span>
            </div>
            <div className="mt-3">
              <div className="rounded-lg bg-primary/[0.08] p-2.5 ring-1 ring-primary/20">
                <p className="font-mono text-xs font-semibold text-foreground">+92 321 •••• 870</p>
                <p className="mt-1 text-[11px] leading-tight text-primary font-medium">
                  Instant WhatsApp Intake Follow-up Dispatched
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-border/50 pt-2 text-[11px]">
            <span className="docket text-primary">Zero Missed Leads</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function Waveform() {
  const bars = [4, 7, 10, 6, 12, 8, 5, 9, 13, 7, 4, 8, 11, 6, 9, 5, 7, 10, 4, 6];
  return (
    <span className="flex h-7 items-center gap-[2.5px]" aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className="w-[2.5px] rounded-full bg-primary/80" style={{ height: `${h * 1.8}px` }} />
      ))}
      <span className="ms-1.5 font-mono text-[11px] text-muted-foreground">0:48</span>
    </span>
  );
}

/** ACT 02 — the five-stage transformation, each stage a real product fragment. */
/** ACT 02 — the five-stage transformation, each stage a real product fragment. */
function FormationRail() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const m = DEMO_MATTER;

  const stages = [
    {
      title: t('lpF1T'),
      desc: t('lpF1D'),
      badge: 'Step 01',
      body: (
        <div className="space-y-2">
          <p dir="ltr" className="rounded-xl rounded-ss-sm bg-background px-3 py-2 text-start text-[12.5px] leading-relaxed ring-1 ring-border">
            {m.thread.c1}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 font-mono">
              <WhatsappGlyph className="size-3 text-[#25d366]" /> +92 300 412
            </span>
            <span className="font-mono">23:42</span>
          </div>
        </div>
      ),
    },
    {
      title: t('lpF2T'),
      desc: t('lpF2D'),
      badge: 'Step 02',
      body: (
        <dl className="space-y-2 rounded-lg bg-background p-2.5 text-[12px] ring-1 ring-border">
          {[
            [t('mfClient'), m.client],
            ['Police station', 'PS Gulberg'],
            [t('mfFir'), '412/26 (Sec 420 PPC)'],
            [t('mfNextDate'), 'Tomorrow 09:00 · Cantt'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-dashed border-border/80 pb-1.5 last:border-0 last:pb-0">
              <dt className={cn('text-muted-foreground', urdu)}>{k}</dt>
              <dd className={cn('font-medium text-foreground', urdu)}>{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      title: t('lpF3T'),
      desc: t('lpF3D'),
      badge: 'Step 03',
      body: (
        <div className="space-y-2">
          <div className="rounded-lg bg-background p-3 ring-1 ring-border">
            <div className="flex items-center justify-between">
              <p className="font-mono text-base font-semibold tracking-tight text-foreground">{m.reference}</p>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Priority A</span>
            </div>
            <Docket className="mt-1.5" items={[t('mfCriminal'), 'LHC Bench III', t('mfIntake')]} />
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">Chambers Reference Assigned</p>
        </div>
      ),
    },
    {
      title: t('lpF4T'),
      desc: t('lpF4D'),
      badge: 'Step 04',
      body: (
        <div className="space-y-2.5 rounded-lg bg-background p-2.5 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <Signal level="critical">{t('mfUrgent')}</Signal>
            <span className="font-mono text-[11px] text-critical">Bail &lt; 24h</span>
          </div>
          <div className="space-y-1.5 border-t border-border/60 pt-2">
            {[
              { doc: 'FIR copy (PS Gulberg)', status: 'Attached ✓', ok: true },
              { doc: 'CNIC of accused', status: 'Requested ⧖', ok: false },
              { doc: 'Vakalatnama signing', status: 'Required !', ok: false },
            ].map((d) => (
              <p key={d.doc} className="flex items-center justify-between gap-1.5 text-[11.5px]">
                <span className="truncate text-muted-foreground">{d.doc}</span>
                <span className={cn('font-mono text-[10px] font-medium', d.ok ? 'text-primary' : 'text-attention')}>
                  {d.status}
                </span>
              </p>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: t('lpF5T'),
      desc: t('lpF5D'),
      badge: 'Step 05',
      body: (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 rounded-lg bg-primary/[0.08] p-3 ring-1 ring-primary/25">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
              {m.lawyerInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">{m.lawyer}</p>
              <p className="text-[11px] text-muted-foreground">Advocate High Court</p>
              <p className={cn('mt-0.5 text-xs font-medium text-primary', urdu)}>{t('mfBriefReady')}</p>
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">Direct SMS / Push Notification</p>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-14">
      {/* Visual Pipeline Track */}
      <div className="mb-4 hidden items-center justify-between px-6 lg:flex" aria-hidden="true">
        {stages.map((s, idx) => (
          <div key={s.badge} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-mono font-semibold text-primary-foreground shadow-sm">
                0{idx + 1}
              </span>
              <span className="docket text-muted-foreground">{s.badge}</span>
            </div>
            {idx < stages.length - 1 ? (
              <div className="mx-3 h-0.5 flex-1 bg-gradient-to-r from-primary/50 to-primary/10 rtl:bg-gradient-to-l" />
            ) : null}
          </div>
        ))}
      </div>

      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border md:grid-cols-2 lg:grid-cols-5">
        {stages.map((stage, i) => (
          <li key={stage.title} className="scroll-reveal flex flex-col bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
              <span className="docket text-primary font-semibold">0{i + 1}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{stage.badge}</span>
            </div>
            <h3 className={cn('mt-3 font-semibold text-foreground', urdu)}>{stage.title}</h3>
            <p className={cn('mt-1 text-sm leading-6 text-muted-foreground', urdu)}>{stage.desc}</p>
            <div className="mt-5 flex-1">{stage.body}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** ACT 03 — a grounded FAQ answer and an urgency trigger, as they appear in the inbox. */
/** ACT 03 — a grounded FAQ answer and an urgency trigger, as they appear in the inbox. */
function IntelligenceProof() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <div className="space-y-4">
      {/* Knowledge Grounding Card */}
      <div className="matter-frame overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            <Docket items={['Sana Ahmed', '+92 333 •••• 118']} className="text-foreground/80" />
          </div>
          <span className="docket text-muted-foreground">10:12 AM</span>
        </div>
        <div className="space-y-3 bg-sunken p-4">
          <p dir="ltr" className="w-fit max-w-[88%] rounded-xl rounded-ss-sm bg-card px-3 py-2 text-start text-[13px] leading-relaxed ring-1 ring-border">
            Consultation fee kitni hai? Aur Saturday ko office khula hota hai?
          </p>
          <div className="ms-auto max-w-[88%]">
            <p dir="ltr" className="rounded-xl rounded-se-sm bg-[var(--wa-firm)] px-3 py-2 text-start text-[13px] leading-relaxed ring-1 ring-primary/15">
              Consultation fee PKR 5,000 hai. Office Saturday ko 10 se 2 baje tak khula hai. Kya main aap ke liye waqt book karoon?
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              <span className={cn('text-xs text-muted-foreground', urdu)}>{t('lpSentAuto')}</span>
              <span className="docket rounded bg-card px-2 py-0.5 text-foreground/80 ring-1 ring-border font-medium">
                {t('lpSource')} · Al-Madad Retainer Schedule (Rule 4.2)
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/80 bg-background/80 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileCheck className="size-3.5 text-primary" aria-hidden="true" />
            <span>Verified from Firm-Approved Schedule · Zero Hallucinated Advice</span>
          </span>
          <span className="docket text-primary font-mono">100% Policy Bound</span>
        </div>
      </div>

      {/* Urgency Trigger Alert */}
      <div className="matter-frame overflow-hidden rounded-2xl border-l-4 border-l-destructive bg-card p-4 ring-1 ring-border shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <Signal level="critical">{t('lpTrigger')} (Sec 420/468/471 PPC)</Signal>
            </div>
            <p className={cn('mt-2 text-sm text-foreground/90 font-medium', urdu)}>{t('lpTriggerMeta')}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              FIR 412/26 · Production before Cantt Judicial Magistrate tomorrow 09:00 AM
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="docket text-muted-foreground">Emergency SLA</p>
            <p className="font-mono text-xl font-bold tabular-nums text-critical">14:52</p>
            <span className="docket text-destructive font-mono text-[10px]">Active Countdown</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Voice receptionist call card — labels are the real inbox strings. */
function VoiceCallCard() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <div className="matter-frame overflow-hidden rounded-2xl bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold', urdu)}>{t('inboxCallTitle')}</p>
          <Docket items={['Ahmed Raza', t('mfLahore'), '01:24']} />
        </div>
        <Signal level="ok">{t('mfLive')}</Signal>
      </div>
      <div className="space-y-3 bg-sunken p-4">
        <p dir="auto" className={cn('w-fit max-w-[88%] rounded-xl rounded-ss-sm bg-card px-3 py-2 text-[13px] leading-relaxed ring-1 ring-border', urdu)}>
          {t('voiceGreetingSample')}
        </p>
        <p dir="auto" className={cn('ms-auto w-fit max-w-[88%] rounded-xl rounded-se-sm bg-[var(--wa-firm)] px-3 py-2 text-[13px] leading-relaxed ring-1 ring-primary/15', urdu)}>
          {t('voiceCallerAsks')}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-3">
        {[t('inboxCallInfo'), t('inboxCallBooked'), t('inboxCallEnded')].map((label) => (
          <span key={label} className={cn('rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground', urdu)}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** ACT 04 — the real HandoffBriefView component rendering the demo matter. */
/** ACT 04 — the real HandoffBriefView component rendering the demo matter. */
function HandoffFrame() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const m = DEMO_MATTER;

  return (
    <div className="matter-frame overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
      {/* Chamber Official Header */}
      <div className="border-b border-border bg-sunken/60 px-5 py-2 text-[11px] flex items-center justify-between">
        <span className="docket text-muted-foreground tracking-wider font-semibold">
          CHAMBER MEMORANDUM · PRIVILEGED ATTORNEY-CLIENT WORK PRODUCT
        </span>
        <span className="font-mono text-muted-foreground text-[10px]">
          LHC · Single Bench III · Cantt Courts
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
        <Signal level="critical">{t('escTriggerACTIVE_ARREST')}</Signal>
        <Docket items={[m.reference, m.client, t('mfLahore')]} className="text-foreground/80 font-medium" />
        <span className="ms-auto flex items-center gap-3">
          <span className="font-mono text-sm font-semibold tabular-nums text-critical">SLA 12:41</span>
          <Button size="sm" className="h-8 px-3 font-medium" tabIndex={-1} aria-hidden>
            <span className={urdu}>{t('escAckClaim')}</span>
          </Button>
        </span>
      </div>
      <div className="p-5">
        <HandoffBriefView reason={DEMO_BRIEF.reason} excerpt={m.thread.c1} brief={DEMO_BRIEF} />
      </div>
    </div>
  );
}

/** ACT 05 — the command center, using the same AttentionRow as the dashboard. */
/** ACT 05 — the command center, using the same AttentionRow as the dashboard. */
function CommandPreview() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <div className="mt-12 overflow-hidden rounded-2xl bg-background shadow-[var(--shadow-frame)] ring-1 ring-border">
      {/* Live Chambers Operations Ticker */}
      <div className="border-b border-border/80 bg-sunken/50 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="live-ping size-2 rounded-full bg-primary" aria-hidden="true" />
          <span className="docket text-foreground font-semibold">Lahore High Court Cause List Synced</span>
          <span className="text-muted-foreground/60" aria-hidden="true">·</span>
          <span className="text-muted-foreground text-[11px]">3 Cantt Court Hearings Today</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>Active Matters: 14</span>
          <span>Bail Urgency: 0 Breaches</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <Docket className="ms-3" items={['Al-Madad Law Associates', t('overview')]} />
      </div>
      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-background p-4 sm:p-5">
          <p className={cn('mb-2 text-sm font-semibold', urdu)}>{t('needsAttentionNow')}</p>
          <AttentionRow
            level="critical"
            title={`${DEMO_MATTER.client} — ${t('escTriggerACTIVE_ARREST')}`}
            meta={<Docket items={[DEMO_MATTER.reference, DEMO_MATTER.lawyer]} />}
            trailing={<span className="font-mono text-sm tabular-nums text-critical">12m</span>}
          />
          <AttentionRow
            level="urgent"
            title="Bilal Hussain — hearing tomorrow, vakalatnama unsigned"
            meta={<Docket items={['WK-1037', 'LHC · Bench III']} />}
            trailing={<span className="docket text-muted-foreground">09:00</span>}
          />
          <AttentionRow
            level="attention"
            title="3 conversations waiting for a lawyer"
            meta={<Docket items={[t('inbox'), '2 AI drafts']} />}
          />
          <AttentionRow
            level="attention"
            title="Fard copy requested from Muhammad Khan"
            meta={<Docket items={['WK-1029', 'Revenue · Sheikhupura']} />}
            trailing={<span className="docket text-muted-foreground">2d</span>}
          />
          <AttentionRow
            level="routine"
            title="PKR 15,000 retainer proof to verify"
            meta={<Docket items={['WK-1018', 'Easypaisa']} />}
          />
        </div>
        <div className="grid grid-cols-1 gap-px bg-border">
          <div className="bg-background p-4 sm:p-5">
            <p className={cn('mb-3 text-sm font-semibold', urdu)}>{t('sigScheduled')}</p>
            <ul className="space-y-2.5 text-[13px]">
              {[
                ['09:00', 'Bail hearing · Cantt courts', 'WK-1042'],
                ['11:30', 'Consultation · Farah Raza', 'WK-1046'],
                ['14:00', 'Civil revision · LHC', 'WK-1011'],
              ].map(([time, what, ref]) => (
                <li key={time} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
                  <span className="font-mono tabular-nums text-muted-foreground">{time}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{what}</span>
                    <span className="docket text-muted-foreground">{ref}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-background p-4 sm:p-5">
            <div className="flex items-baseline justify-between">
              <p className={cn('text-sm font-semibold', urdu)}>{t('aiHandledWeek')}</p>
              <p className="font-mono text-sm tabular-nums">41 / 56</p>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="bg-primary" style={{ width: '73%' }} />
            </div>
            <Docket className="mt-2" items={[`15 ${t('lpToLawyers')}`, `4 ${t('escalations')}`]} />
            <div className="mt-4 border-t border-border/80 pt-3 text-[11px] text-muted-foreground">
              <span className="docket">Practice Distribution: </span>
              <span className="font-mono text-foreground/80">Criminal 45% · Property 35% · Family 20%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ACT 07 — privacy tiers as a ledger, not a feature grid. */
function TierLedger() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  const tiers = [
    { tier: 'T1', name: t('lpT1'), what: t('lpT1D'), rule: t('lpT12Rule'), level: 'ok' as const },
    { tier: 'T2', name: t('lpT2'), what: t('lpT2D'), rule: t('lpT12Rule'), level: 'ok' as const },
    { tier: 'T3', name: t('lpT3'), what: t('lpT3D'), rule: t('lpT3Rule'), level: 'attention' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b border-border bg-sunken px-5 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)]">
          <span className="docket text-muted-foreground">{t('dataTier')}</span>
          <span className={cn('docket text-muted-foreground', urdu)}>{t('lpTierWhat')}</span>
          <span className={cn('docket hidden text-muted-foreground sm:block', urdu)}>{t('lpTierRule')}</span>
        </div>
        {tiers.map((row) => (
          <div
            key={row.tier}
            className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-y-1 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <span className="font-mono text-sm font-medium">{row.tier}</span>
            <div>
              <p className={cn('text-sm font-semibold', urdu)}>{row.name}</p>
              <p className={cn('text-sm text-muted-foreground', urdu)}>{row.what}</p>
            </div>
            <div className="col-start-2 sm:col-start-auto">
              <Signal level={row.level}>{row.rule}</Signal>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border sm:grid-cols-2">
        {[
          ['RLS', t('lpSecRls')],
          ['AUDIT', t('lpSecAudit')],
          ['24H', t('lpSec24h')],
          ['RBAC', t('lpSecRbac')],
        ].map(([code, text]) => (
          <div key={code} className="bg-card p-5">
            <span className="docket text-primary">{code}</span>
            <p className={cn('mt-2 text-sm leading-6', urdu)}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Closing mark — the monogram set as a seal on the chambers stage. */
function WakeelSeal() {
  return (
    <div aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full ring-1 ring-white/15">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
        <svg viewBox="0 0 32 32" className="size-7 text-primary" fill="none" aria-hidden="true">
          <path d="M8 9.5L12 22.5L16 13.5L20 22.5L24 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
