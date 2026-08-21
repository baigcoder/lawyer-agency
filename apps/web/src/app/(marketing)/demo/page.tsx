'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageCircleMore,
  Scale,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { MarketingFooter } from '@/components/marketing-footer';
import { WhatsappPhoneMockup } from '@/components/whatsapp-phone-mockup';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

const demoNavItems = [
  { href: '#', key: 'overview' as const, icon: LayoutDashboard },
  { href: '#', key: 'inbox' as const, icon: Inbox, count: '6' },
  { href: '#', key: 'escalations' as const, icon: AlertTriangle, count: '3' },
  { href: '#', key: 'cases' as const, icon: FolderOpen, count: '12' },
  { href: '#', key: 'documents' as const, icon: FileText },
  { href: '#', key: 'knowledge' as const, icon: Sparkles },
  { href: '#', key: 'calendar' as const, icon: CalendarClock },
  { href: '#', key: 'team' as const, icon: Users },
  { href: '#', key: 'whatsapp' as const, icon: MessageCircleMore },
  { href: '#', key: 'payments' as const, icon: Wallet },
  { href: '#', key: 'analytics' as const, icon: Bot },
  { href: '#', key: 'settings' as const, icon: Settings },
  { href: '#', key: 'setup' as const, icon: ListChecks },
];

const metrics = [
  { title: 'New leads', value: '28', hint: '+18% this week', icon: Inbox },
  { title: 'AI-contained', value: '74%', hint: 'Before staff review', icon: Bot },
  { title: 'Urgent escalations', value: '3', hint: 'All assigned', icon: AlertTriangle },
  { title: 'Fees collected', value: 'PKR 185k', hint: 'Last 30 days', icon: Wallet },
] as const;

const conversations = [
  {
    initials: 'SA',
    name: 'Sana Ahmed',
    preview: 'I received a notice today. What should I bring?',
    time: '2m',
    state: 'Qualified',
    tone: 'default' as const,
  },
  {
    initials: 'MK',
    name: 'Muhammad Khan',
    preview: 'صوتی نوٹ ٹرانسکرائب ہو گیا · مال تنازعہ',
    time: '14m',
    state: 'Needs review',
    tone: 'secondary' as const,
  },
  {
    initials: 'FR',
    name: 'Farah Raza',
    preview: 'Case ki hearing ki date kya hai?',
    time: '31m',
    state: 'Answered',
    tone: 'outline' as const,
  },
  {
    initials: 'HA',
    name: 'Hina Aslam',
    preview: 'اپائنٹمنٹ جمعرات کو کنفرم ہے',
    time: '38m',
    state: 'Booked',
    tone: 'outline' as const,
  },
] as const;

const activity = [
  {
    icon: CircleAlert,
    title: 'Urgent matter routed to Ayesha Khan',
    detail: '48-hour court deadline detected · 4 min ago',
    color: 'text-destructive',
  },
  {
    icon: FileText,
    title: 'FIR photo added to Sana Ahmed\u2019s case',
    detail: 'OCR complete · 12 min ago',
    color: 'text-primary',
  },
  {
    icon: CalendarClock,
    title: 'Consultation booked',
    detail: 'Farah Raza · Thu, 4:30 PM · 28 min ago',
    color: 'text-primary',
  },
  {
    icon: Wallet,
    title: 'Consultation fee received',
    detail: 'PKR 5,000 via Easypaisa · 1 hr ago',
    color: 'text-primary',
  },
] as const;

export default function DemoDashboardPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Scale className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <span className="text-lg font-bold tracking-tight">Wakeel</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              Sign in
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/dashboard" />}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <PageHeader
              icon={Sparkles}
              title="Interactive product preview"
              description="This is exactly what your team sees — a calm, complete view of your firm. Wakeel turns WhatsApp conversations into structured intake, safe AI handoffs, and clear follow-up actions."
              action={
                <div className="flex gap-2">
                  <Button size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
                    Sign in
                    <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/" />}>
                    Back
                  </Button>
                </div>
              }
            />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <DemoSidebar />
          <DemoContent />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

function DemoSidebar() {
  const { t, dir } = useLanguage();
  return (
    <aside className="sticky top-24 hidden h-fit flex-col rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Scale className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">Al-Madad Law</p>
          <p className="text-xs text-muted-foreground">Demo workspace</p>
        </div>
      </div>
      <nav aria-label="Demo navigation" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {demoNavItems.map((item) => (
            <li key={item.key}>
              <span
                className={cn(
                  'group relative flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground',
                  item.key === 'overview' && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                {item.key === 'overview' && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                  />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    item.key === 'overview' && 'text-primary',
                  )}
                  aria-hidden
                />
                <span className={cn('flex-1', dir === 'rtl' && 'font-urdu text-right')}>
                  {t(item.key)}
                </span>
                {item.count && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {item.count}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <div className="rounded-xl bg-primary/5 p-3 ring-1 ring-primary/10">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Smartphone className="h-3.5 w-3.5" aria-hidden /> WhatsApp connected
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            21 of 25 client slots used. Upgrade to official anytime.
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/20">
            <div className="h-full w-[84%] rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function DemoContent() {
  const { t } = useLanguage();
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            hint={metric.hint}
            icon={metric.icon}
            accent={metric.title === 'AI-contained'}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t('priorityInbox')}</CardTitle>
                <CardDescription className="mt-1">
                  WhatsApp conversations become actionable work — in every language your clients use.
                </CardDescription>
              </div>
              <Badge variant="secondary">6 waiting</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.name}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                  {conversation.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{conversation.name}</p>
                    <span className="text-xs text-muted-foreground">{conversation.time}</span>
                  </div>
                  <p
                    dir="auto"
                    className={cn(
                      'truncate text-xs text-muted-foreground',
                      /[\u0600-\u06FF]/.test(conversation.preview) && 'font-urdu',
                    )}
                  >
                    {conversation.preview}
                  </p>
                </div>
                <Badge variant={conversation.tone}>{conversation.state}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What your clients see</CardTitle>
            <CardDescription>Real Urdu conversation with AI disclosure and lawyer handoff.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsappPhoneMockup />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" aria-hidden /> AI guardrails at work
            </CardTitle>
            <CardDescription>
              Automation assists intake; legal judgment stays with your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Guardrail
              title="Disclosed AI assistant"
              detail="Every new client conversation starts with a clear disclosure."
            />
            <Guardrail
              title="Urgent matters escalate"
              detail="Self-harm, violence, arrest, and fast deadlines bypass automation."
            />
            <Guardrail
              title="No legal advice"
              detail="The assistant collects facts, answers approved FAQs, and hands off safely."
            />
            <Guardrail
              title="24-hour rule protected"
              detail="Outside the WhatsApp window, only approved templates can send."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
            <CardDescription>Everything important, without watching every chat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                    <Icon className={cn('h-4 w-4', item.color)} aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="ring-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden /> {t('launchPath')}
          </CardTitle>
          <CardDescription>
            What your firm completes before going live. Official WhatsApp is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <LaunchStep
            done
            title="Create your secure firm workspace"
            description="Add team members, practice areas, and office hours."
          />
          <LaunchStep
            done
            title="Connect WhatsApp free — scan one QR code"
            description="Pilot bridge uses your existing number. No Meta verification needed."
          />
          <LaunchStep
            done
            title="Test the AI with a pretend client message"
            description="Send a test inbound from the setup page and watch the AI reply live."
          />
          <LaunchStep
            title="Invite up to 25 clients — auto-allowlisted"
            description="Anyone who messages your number reaches the AI instantly."
          />
          <LaunchStep
            optional
            title="Upgrade to official WhatsApp (optional)"
            description="Verified business profile, unlimited reach, Meta-approved templates."
          />
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground ring-primary">
        <CardHeader className="py-8 text-center">
          <CardTitle className="text-2xl sm:text-3xl">
            See it with your own number — free
          </CardTitle>
          <CardDescription className="text-primary-foreground/80">
            Free pilot, no credit card. This dashboard fills with your real clients in minutes.
          </CardDescription>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              Start onboarding free
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Back to home
            </Button>
          </div>
        </CardHeader>
      </Card>
    </section>
  );
}

function Guardrail({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function LaunchStep({
  done = false,
  optional = false,
  title,
  description,
}: {
  done?: boolean;
  optional?: boolean;
  title: string;
  description: string;
}) {
  const Icon = done ? CheckCircle2 : optional ? Smartphone : Clock3;
  return (
    <div className="flex gap-3">
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', done ? 'text-primary' : 'text-muted-foreground')}
        aria-hidden
      />
      <div>
        <p className="font-medium">
          {title}
          {optional && (
            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Optional
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
