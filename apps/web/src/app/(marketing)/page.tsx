'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Check,
  FileText,
  Inbox,
  Lock,
  Mic,
  PhoneIncoming,
  Plus,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { FilmDialog } from '@/components/film-dialog';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Section } from '@/components/marketing-section';
import { DEMO_MATTER, MatterFrame } from '@/components/matter-frame';
import {
  AiControlsPanel,
  AnalyticsPanel,
  Bubble,
  Chat,
  CourtDiaryPanel,
  Panel,
  ProductTour,
} from '@/components/product-tour';
import { Signal } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { DEMO_BRIEF } from '@/lib/demo-data';
import { useLandingCopy } from '@/lib/landing-copy';
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

/** Icons per product area, in `copy.features.groups[g].items` order. */
const AREA_ICONS: LucideIcon[][] = [
  [Inbox, Mic, PhoneIncoming, SlidersHorizontal],
  [Briefcase, FileText, CalendarDays, Wallet],
  [Siren, Bell, Users, ChartColumn],
];

export default function Home() {
  const { t, dir } = useLanguage();
  const copy = useLandingCopy();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <div className="min-h-svh overflow-x-clip bg-background text-foreground" dir={dir}>
      <MarketingHeader />

      <main id="main">
        <Hero />

        {/* ── Product tour ─────────────────────────────────────────────── */}
        <Section id="tour" tone="muted" labelledBy="tour-title">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <Heading id="tour-title" eyebrow={copy.tour.eyebrow} title={copy.tour.title} lede={copy.tour.lede} />
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <p className={cn('text-sm text-muted-foreground', urdu)}>{copy.film.tourCta}</p>
              <FilmDialog />
            </div>
          </div>
          <div className="mt-10 sm:mt-12">
            <ProductTour />
          </div>
        </Section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <Section id="how" labelledBy="how-title">
          <Heading id="how-title" eyebrow={copy.how.eyebrow} title={copy.how.title} />
          <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {copy.how.steps.map((step, i) => (
              <li key={step.title} className="bg-card p-6 sm:p-8">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                  {i + 1}
                </span>
                <h3 className={cn('mt-5 text-lg font-semibold tracking-[-0.01em]', urdu)}>{step.title}</h3>
                <p className={cn('mt-2 text-[0.95rem] leading-7 text-muted-foreground', urdu)}>{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Walkthrough: intake → matter record → handoff ────────────── */}
        <Section id="walkthrough" tone="muted" labelledBy="walk-title">
          <Heading id="walk-title" eyebrow={copy.walk.eyebrow} title={copy.walk.title} lede={copy.walk.lede} />
          <ol className="mt-14 space-y-16 sm:space-y-20">
            {copy.walk.steps.map((step, i) => (
              <li key={step.label} className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={cn('lg:sticky lg:top-28 lg:pt-6', i % 2 === 1 && 'lg:order-2')}>
                  <p className={cn('text-sm font-medium text-primary', urdu)}>
                    <span className="tabular-nums">{i + 1}.</span> {step.label}
                  </p>
                  <h3 className={cn('mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]', urdu && 'font-urdu leading-[1.8] tracking-normal')}>
                    {step.title}
                  </h3>
                  <p className={cn('mt-4 max-w-lg text-[1.0625rem] leading-8 text-muted-foreground', urdu)}>{step.body}</p>
                  {i === 2 ? (
                    // Annotations keyed to the numbered sections of the brief card.
                    <ol className="mt-8 grid max-w-lg gap-5 sm:grid-cols-2 lg:grid-cols-1">
                      {copy.walk.brief.annotations.map((a, n) => (
                        <li key={a.title} className="flex gap-3.5">
                          <BriefMarker n={n + 1} />
                          <div>
                            <h4 className={cn('font-semibold', urdu)}>{a.title}</h4>
                            <p className={cn('mt-1 text-sm leading-6 text-muted-foreground', urdu)}>{a.body}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <WalkVisual step={i} />
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Product areas: conversations / matters / the firm ────────── */}
        <Section id="features" labelledBy="features-title">
          <Heading id="features-title" eyebrow={copy.features.eyebrow} title={copy.features.title} lede={copy.features.lede} />
          <div className="mt-14 space-y-20 sm:space-y-24">
            {copy.features.groups.map((group, g) => (
              <article key={group.title} aria-labelledby={`area-${g}`} className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
                <div className={cn(g % 2 === 1 && 'lg:order-2')}>
                  <p className="text-sm font-medium tabular-nums text-muted-foreground">0{g + 1}</p>
                  <h3 id={`area-${g}`} className={cn('mt-2 text-2xl font-semibold tracking-[-0.02em]', urdu && 'font-urdu leading-[1.8] tracking-normal')}>
                    {group.title}
                  </h3>
                  <p className={cn('mt-2 max-w-lg text-[1.0625rem] leading-7 text-muted-foreground', urdu)}>{group.body}</p>
                  <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
                    {group.items.map((item, i) => {
                      const Icon = AREA_ICONS[g]?.[i] ?? Check;
                      return (
                        <li key={item.title} className="flex gap-3.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
                            <Icon className="size-[18px]" aria-hidden />
                          </span>
                          <div>
                            <h4 className={cn('font-semibold', urdu)}>{item.title}</h4>
                            <p className={cn('mt-1 text-sm leading-6 text-muted-foreground', urdu)}>{item.body}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div aria-hidden className="min-w-0 rounded-2xl border border-border bg-sunken p-3 sm:p-5 lg:sticky lg:top-24">
                  {g === 0 ? (
                    <AiControlsPanel copy={copy.features.controls} urdu={urdu} />
                  ) : g === 1 ? (
                    <CourtDiaryPanel ui={copy.tour.ui} urdu={urdu} />
                  ) : (
                    <AnalyticsPanel ui={copy.tour.ui} urdu={urdu} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </Section>

        {/* ── Safeguards ───────────────────────────────────────────────── */}
        <Section id="safeguards" tone="muted" labelledBy="safe-title">
          <Heading id="safe-title" eyebrow={copy.safe.eyebrow} title={copy.safe.title} lede={copy.safe.lede} />
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CheckList icon={ShieldCheck} title={copy.safe.aiTitle} items={copy.safe.ai} />
            <CheckList icon={Lock} title={copy.safe.dataTitle} items={copy.safe.data} />
          </div>
          <p className={cn('mt-6 max-w-3xl text-sm leading-6 text-muted-foreground', urdu)}>{copy.safe.note}</p>
        </Section>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <Section id="pricing" labelledBy="pricing-title" innerClassName="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Heading id="pricing-title" eyebrow={copy.pricing.eyebrow} title={copy.pricing.title} lede={copy.pricing.lede} />
            <p className={cn('mt-6 max-w-md text-sm leading-6 text-muted-foreground', urdu)}>{copy.pricing.meta}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={cn('text-xl font-semibold', urdu)}>{copy.pricing.plan}</h3>
              <p className={cn('text-sm text-muted-foreground', urdu)}>{copy.pricing.planMeta}</p>
            </div>
            <ul className="mt-6 space-y-3 border-t border-border pt-6">
              {copy.pricing.includes.map((item) => (
                <li key={item} className={cn('flex gap-3 text-[0.95rem] leading-6', urdu)}>
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-8 h-11 w-full text-[0.95rem]" nativeButton={false} render={<Link href="/sign-up" />}>
              <span className={urdu}>{copy.pricing.cta}</span>
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Button>
            <p className={cn('mt-3 text-center text-sm text-muted-foreground', urdu)}>{copy.pricing.ctaNote}</p>
          </div>
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <Section id="faq" tone="muted" labelledBy="faq-title" innerClassName="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Heading id="faq-title" eyebrow={copy.faq.eyebrow} title={copy.faq.title} />
          <div className="divide-y divide-border border-y border-border">
            {[...FAQ.map(([q, a]) => ({ q: t(q), a: t(a) })), ...copy.faq.extra].map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-5 text-start [&::-webkit-details-marker]:hidden">
                  <span className={cn('font-semibold', urdu)}>{q}</span>
                  <Plus className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className={cn('max-w-2xl pb-5 text-[0.95rem] leading-7 text-muted-foreground', urdu)}>{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        <Section labelledBy="final-title" size="sm">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 id="final-title" className={cn('text-2xl font-semibold tracking-[-0.02em] sm:text-3xl', urdu && 'font-urdu leading-[1.8] tracking-normal')}>
                {copy.final.title}
              </h2>
              <p className={cn('mt-2 text-[1.0625rem] leading-7 opacity-85', urdu)}>{copy.final.lede}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                className="h-11 bg-primary-foreground px-5 text-[0.95rem] text-primary hover:bg-primary-foreground/90 focus-visible:outline-primary-foreground"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                <span className={urdu}>{copy.hero.primary}</span>
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="h-11 px-5 text-[0.95rem] text-primary-foreground ring-1 ring-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-primary-foreground"
                nativeButton={false}
                render={<Link href="/demo" />}
              >
                <span className={urdu}>{copy.hero.secondary}</span>
              </Button>
            </div>
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function Heading({ id, eyebrow, title, lede }: { id: string; eyebrow: string; title: string; lede?: string }) {
  const { dir } = useLanguage();
  const urdu = dir === 'rtl';
  return (
    <div className="max-w-2xl">
      <p className={cn('text-sm font-medium text-primary', urdu && 'font-urdu')}>{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          'mt-3 text-balance font-semibold',
          urdu ? 'font-urdu text-3xl leading-[1.75] sm:text-[2.25rem]' : 'text-3xl leading-[1.15] tracking-[-0.03em] sm:text-[2.5rem]',
        )}
      >
        {title}
      </h2>
      {lede ? <p className={cn('mt-4 text-pretty text-[1.0625rem] leading-8 text-muted-foreground', urdu && 'font-urdu')}>{lede}</p> : null}
    </div>
  );
}

function Hero() {
  const { dir } = useLanguage();
  const copy = useLandingCopy();
  const isRtl = dir === 'rtl';
  const urdu = isRtl ? 'font-urdu' : undefined;

  return (
    <section aria-labelledby="hero-title" className="border-b border-border">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 xl:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <p className={cn('text-sm font-medium text-primary', urdu)}>{copy.hero.eyebrow}</p>
          <h1
            id="hero-title"
            className={cn(
              'mt-4 text-balance font-semibold',
              isRtl
                ? 'font-urdu text-[2.25rem] leading-[1.75] sm:text-5xl sm:leading-[1.75]'
                : 'text-[2.5rem] leading-[1.05] tracking-[-0.04em] sm:text-5xl xl:text-[3.25rem]',
            )}
          >
            {copy.hero.title}
          </h1>
          <p className={cn('mt-6 max-w-[36rem] text-pretty text-[1.0625rem] leading-8 text-muted-foreground', urdu)}>{copy.hero.lede}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-11 px-5 text-[0.95rem]" nativeButton={false} render={<Link href="/sign-up" />}>
              <span className={urdu}>{copy.hero.primary}</span>
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Button>
            <Button variant="outline" size="lg" className="h-11 px-5 text-[0.95rem]" nativeButton={false} render={<Link href="/demo" />}>
              <span className={urdu}>{copy.hero.secondary}</span>
            </Button>
          </div>
          <FilmDialog variant="link" className="mt-5" />
          <ul className="mt-7 space-y-2.5">
            {copy.hero.points.map((point) => (
              <li key={point} className={cn('flex gap-2.5 text-sm text-foreground/85', urdu)}>
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <figure className="min-w-0">
          <div className="rounded-2xl border border-border bg-sunken p-2 sm:p-4">
            <MatterFrame />
          </div>
          <figcaption className={cn('mt-3 text-center text-xs text-muted-foreground', urdu)}>{copy.hero.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function WalkVisual({ step }: { step: number }) {
  const { dir } = useLanguage();
  const copy = useLandingCopy();
  const ui = copy.tour.ui;
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const m = DEMO_MATTER;

  if (step === 0) {
    return (
      <Chat ui={ui} urdu={urdu}>
        <Bubble from="client" time="23:42">{m.thread.c1}</Bubble>
        <Bubble from="firm" time="23:42">{m.thread.a1}</Bubble>
        <Bubble from="client" time="23:44">{m.thread.c2}</Bubble>
      </Chat>
    );
  }

  if (step === 1) {
    return (
      <Panel title={<span dir="ltr">{m.reference} · {DEMO_BRIEF.matterType}</span>}>
        <dl className="divide-y divide-dashed divide-border text-[13px]">
          {Object.entries(DEMO_BRIEF.facts ?? {}).map(([k, v]) => (
            <div key={k} dir="ltr" className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
              <dt className="capitalize text-muted-foreground">{k}</dt>
              <dd className="text-end font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    );
  }

  return <BriefCard />;
}

function BriefMarker({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
      {n}
    </span>
  );
}

function BriefCell({ n, title, urdu, children, className }: { n: number; title: string; urdu?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card p-5', className)}>
      <h4 className={cn('flex items-center gap-2.5 text-[13px] font-semibold', urdu)}>
        <BriefMarker n={n} />
        {title}
      </h4>
      <div className="mt-3 text-[13.5px] leading-6">{children}</div>
    </section>
  );
}

/**
 * The lawyer handoff brief, condensed for the landing page into four numbered
 * sections that match the annotations beside it. Same demo matter and brief
 * data as the dashboard's HandoffBriefView.
 */
function BriefCard() {
  const { dir } = useLanguage();
  const copy = useLandingCopy();
  const ui = copy.tour.ui;
  const b = copy.walk.brief;
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const m = DEMO_MATTER;
  const facts = DEMO_BRIEF.facts ?? {};
  const pick = ['police station', 'FIR', 'next date', 'language'].filter((k) => k in facts);
  const docs = DEMO_BRIEF.documents?.requests ?? [];

  return (
    <article aria-label={b.title} className="overflow-hidden rounded-2xl bg-background shadow-[var(--shadow-frame)] ring-1 ring-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <Signal level="critical">{ui.trigger}</Signal>
          <p dir="ltr" className="mt-1 truncate text-sm font-semibold">
            {m.reference} · {m.client} · Lahore
          </p>
        </div>
        <div className="text-end">
          <p className={cn('text-[11px] text-muted-foreground', urdu)}>{b.respond}</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-critical">14:52</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-sunken/60 px-5 py-2.5">
        <span className="flex items-center gap-2.5 text-[13px]">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {m.lawyerInitials}
          </span>
          <span className={cn('text-muted-foreground', urdu)}>{ui.assignedTo}</span>
          <span className="font-medium">{m.lawyer}</span>
        </span>
        <span className={cn('rounded-md bg-primary px-3 py-1 text-[12.5px] font-medium text-primary-foreground', urdu)}>{ui.claim}</span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
        <BriefCell urdu={urdu} n={1} title={b.sections[0] ?? ''}>
          <p dir="ltr" className="text-foreground/90">{DEMO_BRIEF.reason}</p>
        </BriefCell>
        <BriefCell urdu={urdu} n={2} title={b.sections[1] ?? ''}>
          <dl dir="ltr" className="space-y-1.5">
            {pick.map((k) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 whitespace-nowrap capitalize text-muted-foreground">{k}</dt>
                <dd className="text-end font-medium">{facts[k]}</dd>
              </div>
            ))}
          </dl>
        </BriefCell>
        <BriefCell urdu={urdu} n={3} title={b.sections[2] ?? ''}>
          <ul dir="ltr" className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.description} className="flex items-start justify-between gap-3">
                <span className="min-w-0">{d.description}</span>
                <Signal level="attention" className="shrink-0">{ui.requested}</Signal>
              </li>
            ))}
            {DEMO_BRIEF.openItems?.[0] ? <li className="pt-1 text-muted-foreground">{DEMO_BRIEF.openItems[0]}</li> : null}
          </ul>
        </BriefCell>
        <BriefCell urdu={urdu} n={4} title={b.sections[3] ?? ''} className="bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]">
          <p dir="ltr" className="font-medium">{DEMO_BRIEF.nextAction}</p>
        </BriefCell>
      </div>
    </article>
  );
}

function CheckList({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }): ReactNode {
  const { dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h3 className={cn('flex items-center gap-2.5 font-semibold', urdu)}>
        <Icon className="size-5 text-primary" aria-hidden />
        {title}
      </h3>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item} className={cn('flex gap-3 text-[0.95rem] leading-7 text-foreground/85', urdu)}>
            <Check className="mt-1.5 size-4 shrink-0 text-primary" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
