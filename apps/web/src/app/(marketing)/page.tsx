'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { LanguageToggle } from '@/components/language-toggle';
import { MarketingFooter } from '@/components/marketing-footer';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { WhatsappPhoneMockup } from '@/components/whatsapp-phone-mockup';
import { useLanguage } from '@/lib/language';

function Header() {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Scale className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">Wakeel</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#product">
            {t('whatIsWakeel')}
          </a>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#how-it-works">
            {t('howItWorks')}
          </a>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#security">
            {t('security')}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            {t('signIn')}
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
            {t('startPilot')}
          </Button>
        </div>
      </div>
    </header>
  );
}

function LawyerHandoff() {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-sm border border-border bg-card p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
            {t('handoffStatus')}
          </p>
          <p className="mt-1 font-semibold">{t('handoffMatter')}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <dl className="divide-y divide-border text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('handoffLocation')}</dt>
          <dd className="font-medium">{t('handoffLocationValue')}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('handoffUrgency')}</dt>
          <dd className="font-medium text-amber-600 dark:text-amber-400">
            {t('handoffUrgencyValue')}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('handoffIntake')}</dt>
          <dd className="font-medium">{t('handoffIntakeValue')}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center gap-3 bg-muted/60 p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          AK
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t('handoffAssigned')}</p>
          <p className="text-sm font-medium">Ayesha Khan</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{t('illustrativeDemo')}</p>
    </div>
  );
}

export default function Home() {
  const { t, dir } = useLanguage();

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

  return (
    <div className="min-h-svh bg-background text-foreground" dir={dir}>
      <Header />

      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div>
              <p className="text-sm font-semibold text-primary">{t('heroBadge')}</p>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                {t('heroTitle')}{' '}
                <span className="text-primary">{t('heroTitleAccent')}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                {t('heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 px-6"
                  nativeButton={false}
                  render={<Link href="/sign-up" />}
                >
                  {t('startPilot')}
                  <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-6"
                  nativeButton={false}
                  render={<Link href="/demo" />}
                >
                  {t('viewDemo')}
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t('pilotNote')}</p>
              <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
                {[t('heroProof1'), t('heroProof2'), t('heroProof3'), t('heroProof4')].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative min-h-[610px] bg-muted/40 p-6 sm:p-10">
              <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden />
              <div className="relative z-10 me-auto max-w-[320px]">
                <WhatsappPhoneMockup />
              </div>
              <div className="relative z-20 -mt-20 ms-auto sm:absolute sm:bottom-10 sm:end-6 sm:mt-0 lg:-end-4">
                <LawyerHandoff />
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-sm font-semibold text-primary">{t('whatIsWakeel')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t('whatIsWakeelTitle')}
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                {t('whatIsWakeelDesc')}
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {[
                {
                  number: '01',
                  title: t('whatIsWakeelPoint1Title'),
                  desc: t('whatIsWakeelPoint1Desc'),
                },
                {
                  number: '02',
                  title: t('whatIsWakeelPoint2Title'),
                  desc: t('whatIsWakeelPoint2Desc'),
                },
                {
                  number: '03',
                  title: t('whatIsWakeelPoint3Title'),
                  desc: t('whatIsWakeelPoint3Desc'),
                },
              ].map((item) => (
                <div key={item.number} className="grid gap-3 py-6 sm:grid-cols-[56px_1fr]">
                  <span className="font-mono text-sm text-primary">{item.number}</span>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">{t('features')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {t('featuresTitle')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t('featuresSubtitle')}</p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
              {outcomes.map((outcome) => (
                <article key={outcome.title} className="flex min-h-80 flex-col bg-background p-7">
                  <div className="flex items-center justify-between">
                    <outcome.icon className="h-5 w-5 text-primary" aria-hidden />
                    <span className="font-mono text-xs text-muted-foreground">{outcome.label}</span>
                  </div>
                  <h3 className="mt-12 text-xl font-semibold">{outcome.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{outcome.desc}</p>
                  <div className="mt-auto flex items-start gap-2 border-t border-border pt-5 text-sm font-medium">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{outcome.proof}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <ShieldCheck className="h-8 w-8 text-primary" aria-hidden />
              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                {t('securityTitle')}
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">{t('securityDesc')}</p>
              <p className="mt-6 border-s-2 border-primary ps-4 text-sm leading-6">
                {t('securityPromise')}
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {[
                { icon: FileCheck2, text: t('securityPoint1') },
                { icon: AlertTriangle, text: t('securityPoint2') },
                { icon: UserRoundCheck, text: t('securityPoint3') },
                { icon: ShieldCheck, text: t('securityPoint4') },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-4 py-5">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <p className="text-sm leading-6">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-primary/30 bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">{t('ctaTitle')}</h2>
              <p className="mt-3 text-primary-foreground/80">{t('ctaDesc')}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                {t('startPilot')}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                nativeButton={false}
                render={<Link href="/demo" />}
              >
                {t('viewDemo')}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
