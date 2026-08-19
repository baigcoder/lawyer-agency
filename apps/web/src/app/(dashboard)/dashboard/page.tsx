'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageCircleMore,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AiControls } from '@/components/overview/ai-controls';
import { DocRequestsWidget } from '@/components/overview/doc-requests-widget';
import { EscalationPreview } from '@/components/overview/escalation-preview';
import { FunnelStrip } from '@/components/overview/funnel-strip';
import { PaymentsFollowup } from '@/components/overview/payments-followup';
import { SlaBanner } from '@/components/overview/sla-banner';
import { TodaySchedule } from '@/components/overview/today-schedule';
import { apiRequest, ApiError } from '@/lib/api-client';
import {
  dailySeriesSchema,
  dashboardMetricsSchema,
  funnelSchema,
  revenueByAreaSchema,
  slaBreachesSchema,
} from '@/lib/schemas/analytics';
import { firmProfileReadSchema } from '@/lib/schemas/firm-profile';
import { lawyerProfileSchema } from '@/lib/schemas/lawyer-profile';
import { inboxListSchema } from '@/lib/schemas/inbox';
import { escalationListSchema } from '@/lib/schemas/escalations';
import { hearingListSchema } from '@/lib/schemas/case';
import { appointmentListSchema } from '@/lib/schemas/appointment';
import { documentRequestListSchema } from '@/lib/schemas/document-requests';
import { paymentListSchema } from '@/lib/schemas/payment';
import { evolutionConnectionStatusSchema } from '@/lib/schemas/whatsapp';
import { formatMoney, humanizeEnum, initialsOf, timeAgo } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const INBOX_POLL_MS = 5_000;

const guardrails = [
  { title: 'Clients know it is an AI', urdu: 'ہر گفتگو میں اے آئی کا تعارف', detail: 'Every new conversation starts with a clear disclosure.' },
  { title: 'Urgent matters reach a lawyer', urdu: 'فوری معاملات فوراً وکیل کو', detail: 'Self-harm, violence, arrest, and fast deadlines bypass automation.' },
  { title: 'No legal advice given', urdu: 'قانونی مشورہ کبھی نہیں', detail: 'The assistant collects facts, answers approved FAQs, and hands off safely.' },
  { title: '24-hour messaging rule respected', urdu: '۲۴ گھنٹے کے قاعدے کی پابندی', detail: 'Outside the WhatsApp window, only approved templates can send.' },
] as const;

const launchSteps = [
  { key: 'firm', title: 'Create your secure firm workspace', description: 'Add team members, practice areas, and office hours.' },
  { key: 'owner', title: 'Complete your professional profile', description: 'Bio, bar membership, and featured cases for AI credibility.' },
  { key: 'whatsapp', title: 'Connect WhatsApp free — scan one QR code', description: 'Link your existing number with your phone. No Meta verification needed.' },
  { key: 'test', title: 'Test the AI with a pretend client message', description: 'Send a test inbound from the setup page and watch the AI reply live.' },
  { key: 'clients', title: 'Invite clients to message your number', description: 'Anyone who messages your linked number reaches the AI instantly.' },
] as const;

export default function OverviewPage() {
  const { t, dir } = useLanguage();
  const { can, session } = useSession();
  const canReadAnalytics = can('analytics:read');
  const canReadPayments = can('payments:read');
  const canManageFirm = can('users:manage');
  const metrics = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => apiRequest('/v1/analytics/dashboard', { schema: dashboardMetricsSchema }),
    enabled: canReadAnalytics,
  });
  const daily = useQuery({
    queryKey: ['analytics', 'daily', 7],
    queryFn: () => apiRequest('/v1/analytics/daily?days=7', { schema: dailySeriesSchema }),
    enabled: canReadAnalytics,
  });
  const funnel = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => apiRequest('/v1/analytics/funnel', { schema: funnelSchema }),
    enabled: canReadAnalytics,
  });
  const revenue = useQuery({
    queryKey: ['analytics', 'revenue-by-area'],
    queryFn: () => apiRequest('/v1/analytics/revenue-by-practice-area', { schema: revenueByAreaSchema }),
    enabled: canReadAnalytics,
  });
  const slaBreaches = useQuery({
    queryKey: ['analytics', 'sla-breaches'],
    queryFn: () => apiRequest('/v1/analytics/sla-breaches', { schema: slaBreachesSchema }),
    refetchInterval: INBOX_POLL_MS,
    enabled: canReadAnalytics,
  });
  const profile = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileReadSchema }),
  });
  const ownerProfile = useQuery({
    queryKey: ['lawyer-profile', 'me'],
    queryFn: () => apiRequest('/v1/lawyers/me/profile', { schema: lawyerProfileSchema }),
    retry: false,
    enabled: canManageFirm,
  });
  const inbox = useQuery({
    queryKey: ['inbox', 'overview', 'HUMAN_REQUIRED'],
    queryFn: () => apiRequest('/v1/inbox?state=HUMAN_REQUIRED', { schema: inboxListSchema }),
    retry: false,
    refetchInterval: INBOX_POLL_MS,
  });
  const openEscalations = useQuery({
    queryKey: ['escalations', 'OPEN'],
    queryFn: () => apiRequest('/v1/escalations?status=OPEN', { schema: escalationListSchema }),
    retry: false,
    refetchInterval: INBOX_POLL_MS,
  });
  const whatsapp = useQuery({
    queryKey: ['whatsapp', 'connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
  });
  const appointmentsToday = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
        limit: '100',
      });
      return apiRequest(`/v1/appointments?${params.toString()}`, { schema: appointmentListSchema });
    },
    retry: false,
  });
  const hearingsToday = useQuery({
    queryKey: ['hearings', 'upcoming', 1],
    queryFn: () => apiRequest('/v1/cases/hearings/upcoming?days=1', { schema: hearingListSchema }),
    retry: false,
  });
  const docRequests = useQuery({
    queryKey: ['document-requests', 'PENDING'],
    queryFn: () => apiRequest('/v1/document-requests?status=PENDING', { schema: documentRequestListSchema }),
    retry: false,
  });
  const payments = useQuery({
    queryKey: ['payments', 'overview'],
    queryFn: () => apiRequest('/v1/payments', { schema: paymentListSchema }),
    retry: false,
    enabled: canReadPayments,
  });

  const firmName = profile.data?.displayName ?? profile.data?.firmName ?? t('yourFirm');
  const connected = (whatsapp.data?.status ?? 'disconnected') === 'connected';
  const firmComplete = Boolean(profile.data?.firmName && profile.data?.city && profile.data?.practiceAreas.length);
  const waitingCount = inbox.data?.length ?? 0;
  const escalationCount = openEscalations.data?.length ?? 0;
  const series = daily.data ?? [];
  const aiHandled7d = series.reduce((acc, p) => acc + p.aiHandled, 0);
  const humanHandled7d = series.reduce((acc, p) => acc + p.humanHandled, 0);
  const slaCount = slaBreaches.data ?? 0;
  const ackMinutes = metrics.data?.avgEscalationAckMinutes7d;

  const launchState: Record<string, boolean> = {
    firm: firmComplete,
    owner: Boolean(ownerProfile.data?.profileCompletedAt),
    whatsapp: connected,
    test: Boolean(profile.data?.setupTestSentAt),
    clients: Boolean(profile.data?.firstClientMessageAt),
  };
  const launchCompleted = launchSteps.filter((s) => launchState[s.key]).length;
  const launchPct = Math.round((launchCompleted / launchSteps.length) * 100);
  const launchDone = launchPct === 100;

  const firstName = session?.name.split(/\s+/)[0] ?? firmName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  const kpiCards = [
    {
      title: t('newConversations7d'),
      value: metrics.data ? String(metrics.data.newLeads7d) : undefined,
      detail: `${metrics.data?.casesOpened7d ?? '—'} ${t('casesOpened7dShort')} · ${metrics.data?.casesClosed7d ?? '—'} ${t('casesClosed7dShort')}`,
      spark: series.map((p) => p.newConversations),
      icon: Inbox,
      href: '/dashboard/inbox',
      isPending: metrics.isPending,
      visible: canReadAnalytics,
    },
    {
      title: t('aiContainment7d'),
      value:
        metrics.data == null
          ? undefined
          : metrics.data.aiContainmentRate === null
            ? '—'
            : `${(metrics.data.aiContainmentRate * 100).toFixed(0)}%`,
      detail: t('handledWithoutStaff'),
      spark: series.map((p) => p.aiHandled),
      icon: Bot,
      href: '/dashboard/analytics',
      isPending: metrics.isPending,
      visible: canReadAnalytics,
    },
    {
      title: t('openEscalations'),
      value: openEscalations.isSuccess ? String(escalationCount) : undefined,
      detail:
        ackMinutes == null
          ? t('awaitingStaffAction')
          : `${t('avgAckTime')}: ${ackMinutes}m`,
      spark: series.map((p) => p.escalations),
      icon: AlertTriangle,
      href: '/dashboard/escalations',
      isPending: openEscalations.isPending,
      visible: true,
    },
    {
      title: t('feesCollected30d'),
      value: metrics.data ? formatMoney(metrics.data.feesCollectedCents30d) : undefined,
      detail: t('recordedSuccessfulPayments'),
      spark: series.map((p) => p.paymentsCents),
      icon: Wallet,
      href: '/dashboard/payments',
      isPending: metrics.isPending,
      visible: canReadAnalytics && canReadPayments,
    },
  ].filter((card) => card.visible);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${firmName} · ${t('firmOverviewSummary')}`}
        action={
          <Button nativeButton={false} variant="outline" render={<Link href={connected ? '/dashboard/whatsapp' : '/dashboard/setup'} />}>
            <MessageCircleMore className="me-2 h-4 w-4" />
            {connected ? t('manageWhatsapp') : t('connectWhatsapp')}
          </Button>
        }
      />

      <AiControls canManage={canManageFirm} />

      {canReadAnalytics && metrics.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('couldntLoadMetrics')}:{' '}
          {metrics.error instanceof ApiError ? metrics.error.message : t('unknownError')}
          {metrics.error instanceof ApiError && metrics.error.correlationId && (
            <span className="ms-2 text-xs text-muted-foreground">
              {t('correlationId')}: {metrics.error.correlationId}
            </span>
          )}
        </p>
      ) : null}

      {canReadAnalytics ? <SlaBanner count={slaCount} /> : null}

      <div className={cn(
        'grid gap-4',
        kpiCards.length > 1 && 'sm:grid-cols-2',
        kpiCards.length === 3 && 'xl:grid-cols-3',
        kpiCards.length >= 4 && 'xl:grid-cols-4',
      )}>
        {kpiCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            isPending={card.isPending}
            detail={<span className="font-medium text-primary">{card.detail}</span>}
            icon={card.icon}
            spark={card.spark}
            href={card.href}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={cn(waitingCount > 0 && 'border-amber-500/30 shadow-sm ring-1 ring-amber-500/10')}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t('priorityInbox')}</CardTitle>
                <CardDescription>{t('conversationsWaiting')}</CardDescription>
              </div>
              {waitingCount > 0 ? <Badge variant="destructive">{waitingCount} {t('waiting')}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {inbox.isPending ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('loadingInbox')}>
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : null}
            {inbox.isError ? (
              <p role="alert" className="text-sm text-muted-foreground">
                {t('couldntLoadInbox')}{' '}
                <Link href="/dashboard/inbox" className="underline">{t('openFullInbox')}</Link>
              </p>
            ) : null}
            {inbox.isSuccess && waitingCount === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {connected ? t('nothingWaiting') : t('connectWhatsappForInbox')}
              </p>
            ) : null}
            {inbox.isSuccess && waitingCount > 0
              ? inbox.data.slice(0, 5).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/dashboard/inbox?conversation=${conversation.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                      {initialsOf(conversation.client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{conversation.client.name ?? t('unknown')}</p>
                        {conversation.lastClientMessageAt ? (
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(conversation.lastClientMessageAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {conversation.lastMessage?.body ?? t('noPreview')}
                      </p>
                    </div>
                    <Badge variant="destructive">{humanizeEnum(conversation.state)}</Badge>
                  </Link>
                ))
              : null}
            {waitingCount > 0 ? (
              <div className="pt-2">
                <Button nativeButton={false} size="sm" render={<Link href="/dashboard/inbox" />}>
                  {t('openFullInbox')}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <TodaySchedule
          appointments={appointmentsToday.data}
          hearings={hearingsToday.data}
          isPending={appointmentsToday.isPending || hearingsToday.isPending}
          isError={appointmentsToday.isError || hearingsToday.isError}
        />
      </div>

      {openEscalations.isSuccess && docRequests.isSuccess && escalationCount === 0 && docRequests.data.length === 0 ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="font-medium">{t('allClear')}</p>
              <p className="text-sm text-muted-foreground">{t('allClearDetail')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <EscalationPreview
            items={openEscalations.data}
            isPending={openEscalations.isPending}
            isError={openEscalations.isError}
          />
          <DocRequestsWidget
            items={docRequests.data}
            isPending={docRequests.isPending}
            isError={docRequests.isError}
          />
        </div>
      )}

      {canReadAnalytics ? (
        <FunnelStrip
          funnel={funnel.data}
          revenue={revenue.data}
          aiHandled={aiHandled7d}
          humanHandled={humanHandled7d}
          isPending={funnel.isPending || revenue.isPending}
          isError={funnel.isError || revenue.isError}
        />
      ) : null}

      {canReadPayments ? (
      <PaymentsFollowup
        items={payments.data}
        isPending={payments.isPending}
        isError={payments.isError}
      />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canManageFirm && !launchDone ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('launchPath')}</CardTitle>
            <CardDescription>
              {launchDone ? t('launchComplete') : t('whatYourFirmCompletes')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{launchCompleted} {t('of')} {launchSteps.length} {t('complete')}</span>
                <span className="font-medium text-primary">{launchPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${launchPct}%` }}
                />
              </div>
            </div>
            {!launchDone
              ? launchSteps.map((step) => {
                  const done = launchState[step.key];
                  const Icon = done ? CheckCircle2 : Clock3;
                  return (
                    <div key={step.key} className="flex gap-3">
                      <Icon
                        className={cn('mt-0.5 h-4 w-4 shrink-0', done ? 'text-primary' : 'text-muted-foreground')}
                        aria-hidden
                      />
                      <div>
                        <p className="font-medium">{step.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  );
                })
              : (
                <p className="text-sm text-muted-foreground">{t('launchCompleteHint')}</p>
              )}
            <div className="pt-2">
              <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/setup" />}>
                {t('openSetupChecklist')}
              </Button>
            </div>
          </CardContent>
        </Card>
        ) : null}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> {t('safetyRules')}
              </CardTitle>
              <CardDescription>{t('automationAssists')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {guardrails.map((guardrail) => (
                <div key={guardrail.title} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium">{dir === 'rtl' ? guardrail.urdu : guardrail.title}</p>
                    {dir === 'rtl' && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{guardrail.title}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">{guardrail.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {!connected ? (
        <Card className="border-primary/20 bg-primary/5 ring-primary/20">
          <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{t('readyToConnect')}</p>
              <p className="text-sm text-muted-foreground">
                {t('scanQrCode')}
              </p>
            </div>
            <Button nativeButton={false} render={<Link href="/dashboard/setup" />}>
              {t('connectWhatsapp')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
