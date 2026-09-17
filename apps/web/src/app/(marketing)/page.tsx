'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FolderOpen,
  LayoutDashboard,
  MessageCircleMore,
  Phone,
  Scale,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Section, SectionHeading } from '@/components/marketing-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WhatsappPhoneMockup } from '@/components/whatsapp-phone-mockup';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/** Small primary-tinted glyph tile — the icon treatment used across the app. */
function IconTile({
  icon: Icon,
  className,
}: {
  icon: typeof Scale;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20',
        className,
      )}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
    </span>
  );
}

/**
 * The firm-side half of the hero story: what lands in the dashboard once the
 * client conversation is done.
 */
function LawyerHandoff() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  const rows = [
    { label: t('handoffLocation'), value: t('handoffLocationValue'), accent: false },
    { label: t('handoffUrgency'), value: t('handoffUrgencyValue'), accent: true },
    { label: t('handoffIntake'), value: t('handoffIntakeValue'), accent: false },
  ];

  return (
    <Card className="w-full shadow-lg shadow-black/5">
      <CardHeader className="border-b pb-(--card-spacing)">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge
              variant="secondary"
              className={cn(
                'h-auto whitespace-normal bg-amber-500/15 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
                urdu && 'font-urdu tracking-normal',
              )}
            >
              {t('handoffStatus')}
            </Badge>
            <CardTitle className={cn('mt-2 text-sm', urdu)}>{t('handoffMatter')}</CardTitle>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <dl className="divide-y divide-border text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className={cn('text-muted-foreground', urdu)}>{row.label}</dt>
              <dd
                className={cn(
                  'text-end font-medium',
                  row.accent && 'text-amber-700 dark:text-amber-300',
                  urdu,
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>

      <CardFooter className="flex-col items-start gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20">
            AK
          </span>
          <div>
            <p className={cn('text-[11px] text-muted-foreground', urdu)}>{t('handoffAssigned')}</p>
            <p className="text-xs font-medium">Ayesha Khan</p>
          </div>
        </div>
        <p className={cn('text-[10px] text-muted-foreground', urdu)}>{t('illustrativeDemo')}</p>
      </CardFooter>
    </Card>
  );
}

/**
 * Client phone + firm handoff, side by side.
 *
 * These two used to be stacked with negative offsets so the handoff card
 * covered the phone's message column — the most persuasive part of the page.
 * They now share a grid, so no positioning value can put one on top of the
 * other at any width or in either writing direction.
 */
function HeroVisual() {
  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-muted/70 via-muted/40 to-muted/10 p-5 ring-1 ring-foreground/5 sm:p-7">
      <div className="mx-auto grid max-w-[640px] items-end gap-6 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:max-w-none">
        <div className="mx-auto w-full max-w-[280px] sm:mx-0">
          <WhatsappPhoneMockup />
        </div>
        <div className="mx-auto w-full max-w-[340px] sm:mx-0 sm:max-w-none">
          <LawyerHandoff />
        </div>
      </div>
    </div>
  );
}

/**
 * The inbox CALL card (D-124), shown as it appears after the AI receptionist
 * takes a WhatsApp call: the disclosure it is required to open with, the
 * caller's ask, and the dispositions the call can end in.
 *
 * Every label here is the real dashboard string (`inboxCall*`), so the
 * marketing claim and the product cannot drift apart.
 */
function VoiceCallCard() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  const turns = [
    { from: 'ai' as const, text: t('voiceGreetingSample') },
    { from: 'caller' as const, text: t('voiceCallerAsks') },
  ];

  return (
    <Card className="shadow-lg shadow-black/5">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Phone className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className={cn('text-sm', urdu)}>{t('inboxCallTitle')}</CardTitle>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              Ahmed Raza · Lahore · 1:24
            </p>
          </div>
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary ring-2 ring-primary/20"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {turns.map((turn) => (
          <div
            key={turn.from}
            className={cn('flex', turn.from === 'caller' ? 'justify-end' : 'justify-start')}
          >
            <p
              dir="auto"
              className={cn(
                'max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-6',
                turn.from === 'ai'
                  ? 'rounded-ss-sm bg-muted text-foreground'
                  : 'rounded-se-sm bg-primary/10 text-foreground ring-1 ring-primary/15',
                urdu,
              )}
            >
              {turn.text}
            </p>
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex-col items-start gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {[t('inboxCallInfo'), t('inboxCallBooked'), t('inboxCallEnded')].map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className={cn('h-auto whitespace-normal py-0.5', urdu && 'font-urdu')}
            >
              {label}
            </Badge>
          ))}
        </div>
        <p className={cn('text-[10px] text-muted-foreground', urdu)}>{t('illustrativeDemo')}</p>
      </CardFooter>
    </Card>
  );
}

export default function Home() {
  const { t, dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const urdu = isRtl ? 'font-urdu' : undefined;

  const outcomes = [
    {
      icon: Clock3,
      label: '11:42 PM',
      title: t('feature1Title'),
      desc: t('feature1Desc'),
      proof: t('feature1Proof'),
    },
    {
      icon: AlertTriangle,
      label: t('feature2Label'),
      title: t('feature2Title'),
      desc: t('feature2Desc'),
      proof: t('feature2Proof'),
    },
    {
      icon: BookOpenCheck,
      label: t('feature3Label'),
      title: t('feature3Title'),
      desc: t('feature3Desc'),
      proof: t('feature3Proof'),
    },
  ];

  const capabilities = [
    { icon: CalendarClock, title: t('featureCalendarTitle'), desc: t('featureCalendarDesc') },
    { icon: FolderOpen, title: t('featureDocsTitle'), desc: t('featureDocsDesc') },
    { icon: LayoutDashboard, title: t('featureAnalyticsTitle'), desc: t('featureAnalyticsDesc') },
  ];

  const steps = [
    { icon: Smartphone, title: t('step1Title'), desc: t('step1Desc') },
    { icon: BookOpenCheck, title: t('step2Title'), desc: t('step2Desc') },
    { icon: Users, title: t('step3Title'), desc: t('step3Desc') },
  ];

  const explainer = [
    { title: t('whatIsWakeelPoint1Title'), desc: t('whatIsWakeelPoint1Desc') },
    { title: t('whatIsWakeelPoint2Title'), desc: t('whatIsWakeelPoint2Desc') },
    { title: t('whatIsWakeelPoint3Title'), desc: t('whatIsWakeelPoint3Desc') },
  ];

  const trust = [
    { icon: Scale, text: t('trustedPakistanFirms') },
    { icon: ShieldCheck, text: t('trustedRls') },
    { icon: UserRoundCheck, text: t('trustedNoAdvice') },
  ];

  const voicePoints = [
    { icon: UserRoundCheck, text: t('voicePoint1') },
    { icon: CalendarClock, text: t('voicePoint2') },
    { icon: AlertTriangle, text: t('voicePoint3') },
    { icon: MessageCircleMore, text: t('voicePoint4') },
  ];

  const guarantees = [
    { icon: FileCheck2, text: t('securityPoint1') },
    { icon: AlertTriangle, text: t('securityPoint2') },
    { icon: UserRoundCheck, text: t('securityPoint3') },
    { icon: ShieldCheck, text: t('securityPoint4') },
  ];

  return (
    <div className="min-h-svh bg-background text-foreground" dir={dir}>
      <MarketingHeader />

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <Section
          size="lg"
          className="border-b border-border"
          innerClassName="grid gap-12 xl:grid-cols-[0.85fr_1.15fr] xl:items-center xl:gap-16"
        >
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <Badge
              variant="secondary"
              className={cn(
                'h-auto whitespace-normal py-1 text-xs font-semibold text-primary',
                urdu && 'font-urdu',
              )}
            >
              {t('heroBadge')}
            </Badge>

            <h1
              className={cn(
                'mt-5 max-w-2xl text-4xl font-bold tracking-[-0.035em] sm:text-5xl lg:text-6xl',
                isRtl ? 'font-urdu leading-[1.45] tracking-normal' : 'leading-[1.08]',
              )}
            >
              {t('heroTitle')} <span className="text-primary">{t('heroTitleAccent')}</span>
            </h1>

            <p className={cn('mt-6 max-w-xl text-lg leading-8 text-muted-foreground', urdu)}>
              {t('heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 px-6 text-[0.95rem]"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                {t('startPilot')}
                <ArrowRight className={cn('ms-2 h-4 w-4', isRtl && 'rotate-180')} aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-6 text-[0.95rem]"
                nativeButton={false}
                render={<Link href="/demo" />}
              >
                {t('viewDemo')}
              </Button>
            </div>

            <p className={cn('mt-4 text-sm text-muted-foreground', urdu)}>{t('pilotNote')}</p>

            <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
              {[t('heroProof1'), t('heroProof2'), t('heroProof3'), t('heroProof4')].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className={urdu}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <HeroVisual />
        </Section>

        {/* ── Trust strip ──────────────────────────────────────────────── */}
        <Section tone="muted" size="sm">
          <p
            className={cn(
              'text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground',
              urdu && 'font-urdu tracking-normal',
            )}
          >
            {t('trustedBy')}
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
            {trust.map((item) => (
              <li key={item.text} className="flex items-center justify-center gap-3 text-center">
                <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className={cn('text-sm font-medium', urdu)}>{item.text}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── What is Wakeel ───────────────────────────────────────────── */}
        <Section id="product" innerClassName="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow={t('whatIsWakeel')}
            title={t('whatIsWakeelTitle')}
            lede={t('whatIsWakeelDesc')}
            urdu={isRtl}
            className="lg:sticky lg:top-24 lg:self-start"
          />

          <Card>
            <CardContent className="divide-y divide-border">
              {explainer.map((item, index) => (
                <div
                  key={item.title}
                  className="grid gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[48px_1fr]"
                >
                  <span className="font-mono text-sm font-medium text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className={cn('font-semibold', urdu)}>{item.title}</h3>
                    <p className={cn('mt-2 text-sm leading-6 text-muted-foreground', urdu)}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <Section id="how-it-works" tone="muted">
          <SectionHeading
            title={t('howItWorks')}
            lede={t('howItWorksSubtitle')}
            urdu={isRtl}
          />
          <ol className="mt-12 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <IconTile icon={step.icon} className="h-8 w-8" />
                    </div>
                    <CardTitle className={cn('mt-4 text-base', urdu)}>{step.title}</CardTitle>
                    <CardDescription className={cn('mt-2 leading-6', urdu)}>
                      {step.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <Section id="features">
          <SectionHeading
            eyebrow={t('features')}
            title={t('featuresTitle')}
            lede={t('featuresSubtitle')}
            urdu={isRtl}
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {outcomes.map((outcome) => (
              <Card
                key={outcome.title}
                className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <IconTile icon={outcome.icon} />
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-mono text-[10px] tracking-wide text-muted-foreground',
                        urdu && 'font-urdu tracking-normal',
                      )}
                    >
                      {outcome.label}
                    </Badge>
                  </div>
                  <CardTitle className={cn('mt-5 text-lg leading-snug', urdu)}>
                    {outcome.title}
                  </CardTitle>
                  <CardDescription className={cn('mt-2 leading-6', urdu)}>
                    {outcome.desc}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto items-start gap-2.5 text-sm font-medium">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className={urdu}>{outcome.proof}</span>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <Card
                key={capability.title}
                size="sm"
                className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <IconTile icon={capability.icon} className="h-8 w-8" />
                    <CardTitle className={cn('text-sm', urdu)}>{capability.title}</CardTitle>
                  </div>
                  <CardDescription className={cn('mt-2 leading-6', urdu)}>
                    {capability.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Section>

        {/* ── Voice receptionist (D-124) ───────────────────────────────── */}
        <Section id="voice" tone="muted" innerClassName="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="flex items-center gap-3">
              <IconTile icon={Phone} />
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.16em] text-primary',
                  urdu && 'font-urdu tracking-normal',
                )}
              >
                {t('overviewAiTakesCalls')}
              </p>
            </div>
            <h2
              className={cn(
                'mt-6 text-3xl font-bold tracking-tight sm:text-4xl',
                isRtl && 'font-urdu leading-[1.55] tracking-normal',
              )}
            >
              {t('voiceTitle')}
            </h2>
            <p className={cn('mt-5 text-lg leading-8 text-muted-foreground', urdu)}>
              {t('voiceDesc')}
            </p>
            <ul className="mt-8 space-y-4">
              {voicePoints.map((point) => (
                <li key={point.text} className="flex items-start gap-3.5">
                  <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <p className={cn('text-sm leading-6', urdu)}>{point.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <VoiceCallCard />
        </Section>

        {/* ── Security ─────────────────────────────────────────────────── */}
        <Section id="security" innerClassName="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-24">
            <IconTile icon={ShieldCheck} className="h-11 w-11" />
            <h2
              className={cn(
                'mt-6 text-3xl font-bold tracking-tight sm:text-4xl',
                isRtl && 'font-urdu leading-[1.55] tracking-normal',
              )}
            >
              {t('securityTitle')}
            </h2>
            <p className={cn('mt-5 text-lg leading-8 text-muted-foreground', urdu)}>
              {t('securityDesc')}
            </p>
            <p
              className={cn(
                'mt-6 rounded-lg border-s-2 border-primary bg-primary/5 px-4 py-3 text-sm leading-6',
                urdu,
              )}
            >
              {t('securityPromise')}
            </p>
          </div>

          <Card>
            <CardContent className="divide-y divide-border">
              {guarantees.map((item) => (
                <div key={item.text} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <p className={cn('text-sm leading-6', urdu)}>{item.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        <Section>
          <div className="flex flex-col justify-between gap-8 rounded-3xl bg-primary px-6 py-12 text-primary-foreground ring-1 ring-primary/40 sm:px-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2
                className={cn(
                  'text-3xl font-bold tracking-tight',
                  isRtl && 'font-urdu leading-[1.55] tracking-normal',
                )}
              >
                {t('ctaTitle')}
              </h2>
              <p className={cn('mt-3 text-primary-foreground/85', urdu)}>{t('ctaDesc')}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-6"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                {t('startPilot')}
                <ArrowRight className={cn('ms-2 h-4 w-4', isRtl && 'rotate-180')} aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 dark:border-primary-foreground/30 dark:bg-transparent dark:hover:bg-primary-foreground/10"
                nativeButton={false}
                render={<Link href="/demo" />}
              >
                {t('viewDemo')}
              </Button>
            </div>
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}
