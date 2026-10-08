'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3, MessageCircleMore } from 'lucide-react';

import { AttentionRow } from '@/components/attention-row';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AiControls } from '@/components/overview/ai-controls';
import { Meter, Panel } from '@/components/workspace/panel';
import { SlaClock, useNow } from '@/components/workspace/sla-clock';
import { apiRequest } from '@/lib/api-client';
import {
  dailySeriesSchema,
  dashboardMetricsSchema,
  funnelSchema,
  slaBreachesSchema,
} from '@/lib/schemas/analytics';
import { firmProfileReadSchema } from '@/lib/schemas/firm-profile';
import { lawyerProfileSchema } from '@/lib/schemas/lawyer-profile';
import { inboxListSchema, type InboxSummary } from '@/lib/schemas/inbox';
import { escalationListSchema, type EscalationSummary } from '@/lib/schemas/escalations';
import { hearingListSchema } from '@/lib/schemas/case';
import { appointmentListSchema } from '@/lib/schemas/appointment';
import { documentRequestListSchema } from '@/lib/schemas/document-requests';
import { paymentListSchema } from '@/lib/schemas/payment';
import { evolutionConnectionStatusSchema } from '@/lib/schemas/whatsapp';
import { formatMoney, timeAgo } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const POLL_MS = 5_000;
const OVERDUE_DAYS = 14;

const launchSteps = [
  { key: 'firm', title: 'Create your secure firm workspace', description: 'Add team members, practice areas, and office hours.' },
  { key: 'owner', title: 'Complete your professional profile', description: 'Bio, bar membership, and featured cases for AI credibility.' },
  { key: 'whatsapp', title: 'Connect WhatsApp', description: 'Link your firm’s number so clients reach Wakeel.' },
  { key: 'test', title: 'Test the AI with a pretend client message', description: 'Send a test inbound from the setup page and watch the AI reply live.' },
  { key: 'clients', title: 'Invite clients to message your number', description: 'Anyone who messages your linked number reaches the AI instantly.' },
] as const;

function escalationLevel(e: EscalationSummary): SignalLevel {
  return e.triggerType === 'IMMINENT_DEADLINE' || e.triggerType === 'MANUAL' ? 'urgent' : 'critical';
}

function clientLabel(c: InboxSummary['client']) {
  return c.name ?? c.waPhone;
}

function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/**
 * Command center. Answers, in order: what is critical, what is waiting for
 * a lawyer, what is scheduled, what the AI handled — then the money and the
 * pipeline. Priority is carried by Chambers Signals, not by card size.
 */
export default function OverviewPage() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const { can, session } = useSession();
  const canReadAnalytics = can('analytics:read');
  const canReadPayments = can('payments:read');
  const canManageFirm = can('users:manage');
  const isOwner = Boolean(session?.isOwner || canManageFirm);
  const isStaff = session?.role === 'Staff';

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
  const slaBreaches = useQuery({
    queryKey: ['analytics', 'sla-breaches'],
    queryFn: () => apiRequest('/v1/analytics/sla-breaches', { schema: slaBreachesSchema }),
    refetchInterval: POLL_MS,
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
  const waiting = useQuery({
    queryKey: ['inbox', 'overview', isOwner ? 'HUMAN_REQUIRED' : 'assignedToMe'],
    queryFn: () =>
      apiRequest(isOwner ? '/v1/inbox?state=HUMAN_REQUIRED' : '/v1/inbox?assignedToMe=true', { schema: inboxListSchema }),
    retry: false,
    refetchInterval: POLL_MS,
    enabled: can('inbox:read'),
  });
  const openEscalations = useQuery({
    queryKey: ['escalations', 'OPEN'],
    queryFn: () => apiRequest('/v1/escalations?status=OPEN', { schema: escalationListSchema }),
    retry: false,
    refetchInterval: POLL_MS,
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
      end.setDate(end.getDate() + 2);
      const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString(), limit: '100' });
      return apiRequest(`/v1/appointments?${params.toString()}`, { schema: appointmentListSchema });
    },
    retry: false,
  });
  const hearingsSoon = useQuery({
    queryKey: ['hearings', 'upcoming', 2],
    queryFn: () => apiRequest('/v1/cases/hearings/upcoming?days=2', { schema: hearingListSchema }),
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
  const connected = whatsapp.data?.status === 'connected';
  const escalations = [...(openEscalations.data ?? [])].sort((a, b) => a.slaDeadline.getTime() - b.slaDeadline.getTime());
  const waitingList = waiting.data ?? [];
  const drafts = waitingList.filter((c) => c.pendingDraft).length;
  const series = daily.data ?? [];
  const aiHandled = series.reduce((n, p) => n + p.aiHandled, 0);
  const humanHandled = series.reduce((n, p) => n + p.humanHandled, 0);
  const proofs = (payments.data ?? []).filter((p) => p.status === 'PENDING');
  const overdueCutoff = useNow(60_000) - OVERDUE_DAYS * 86_400_000;
  const overdue = (payments.data ?? []).filter((p) => p.status === 'REQUESTED' && p.requestedAt.getTime() < overdueCutoff);
  const breaches = slaBreaches.data ?? 0;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const diary = [
    ...(hearingsSoon.data ?? []).map((h) => ({
      key: h.id,
      at: h.hearingAt,
      title: h.courtName,
      meta: [h.judge, h.location],
      level: 'urgent' as SignalLevel,
      href: '/dashboard/calendar',
    })),
    ...(appointmentsToday.data ?? [])
      .filter((a) => a.status !== 'CANCELLED')
      .map((a) => ({
        key: a.id,
        at: a.startsAt,
        title: `${t('demoConsultation')} · ${a.clientName ?? a.clientWaPhone}`,
        meta: [a.lawyerName, a.location],
        level: 'routine' as SignalLevel,
        href: '/dashboard/calendar',
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const todayCount = diary.filter((d) => d.at <= endOfToday).length;

  const launchState: Record<string, boolean> = {
    firm: Boolean(profile.data?.firmName && profile.data?.city && profile.data?.practiceAreas.length),
    owner: Boolean(ownerProfile.data?.profileCompletedAt),
    whatsapp: connected,
    test: Boolean(profile.data?.setupTestSentAt),
    clients: Boolean(profile.data?.firstClientMessageAt),
  };
  const launchCompleted = launchSteps.filter((s) => launchState[s.key]).length;
  const launchDone = launchCompleted === launchSteps.length;

  const firstName = session?.name.split(/\s+/)[0] ?? firmName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');
  const dateDocket = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  const attentionCount = escalations.length + waitingList.length + proofs.length + (docRequests.data?.length ?? 0) + overdue.length + (connected ? 0 : 1) + (breaches > 0 ? 1 : 0);
  const attentionPending = openEscalations.isPending || waiting.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span suppressHydrationWarning>
            {dateDocket} · {profile.data?.city ?? ''}
          </span>
        }
        title={`${greeting}, ${firstName}`}
        description={
          attentionPending
            ? `${firmName}`
            : attentionCount === 0
              ? t('allClearDetail')
              : `${firmName} · ${attentionCount} ${t('ovItemsNeedYou')}`
        }
        action={
          <Button nativeButton={false} variant="outline" size="sm" className="h-8" render={<Link href="/dashboard/inbox" />}>
            <MessageCircleMore aria-hidden />
            {t('openFullInbox')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          title={t('demoMetricCritical')}
          value={openEscalations.isSuccess ? escalations.length : undefined}
          isPending={openEscalations.isPending}
          signal={escalations.length ? 'critical' : 'ok'}
          detail={
            metrics.data?.avgEscalationAckMinutes7d != null
              ? `${t('avgAckTime')}: ${metrics.data.avgEscalationAckMinutes7d}m`
              : <Docket items={escalations.slice(0, 3).map((e) => e.client.name ?? e.client.waPhone)} />
          }
          href="/dashboard/escalations"
        />
        <MetricCard
          title={isOwner ? t('demoMetricWaiting') : t('assignedToMe')}
          value={waiting.isSuccess ? waitingList.length : undefined}
          isPending={waiting.isPending}
          signal={waitingList.length ? 'attention' : 'routine'}
          detail={`${drafts} ${t('demoDraftsAwaiting')}`}
          href={isOwner ? '/dashboard/inbox?tab=HUMAN_REQUIRED' : '/dashboard/inbox?tab=ME'}
        />
        <MetricCard
          title={t('sigScheduled')}
          value={appointmentsToday.isSuccess || hearingsSoon.isSuccess ? todayCount : undefined}
          isPending={appointmentsToday.isPending && hearingsSoon.isPending}
          signal="routine"
          detail={`${diary.length - todayCount} ${t('demoTomorrow')}`}
          href="/dashboard/calendar"
        />
        {canReadAnalytics ? (
          <MetricCard
            title={t('aiContainment7d')}
            value={
              metrics.data == null
                ? undefined
                : metrics.data.aiContainmentRate === null
                  ? '—'
                  : `${Math.round(metrics.data.aiContainmentRate * 100)}%`
            }
            isPending={metrics.isPending}
            signal="ok"
            detail={`${aiHandled} / ${aiHandled + humanHandled}`}
            spark={series.map((p) => p.aiHandled)}
            href="/dashboard/analytics"
          />
        ) : (
          <MetricCard
            title={t('docRequestsTitle')}
            value={docRequests.isSuccess ? docRequests.data.length : undefined}
            isPending={docRequests.isPending}
            signal="routine"
            href="/dashboard/documents"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel
          title={t('needsAttentionNow')}
          meta={attentionPending ? '…' : `${attentionCount} ${t('demoItems')}`}
          bodyClassName="p-2"
        >
          {attentionPending ? <RowsSkeleton /> : null}
          {!connected && whatsapp.isSuccess ? (
            <AttentionRow
              level="critical"
              href={canManageFirm ? '/dashboard/setup' : '/dashboard/whatsapp'}
              title={t('ovWhatsappDown')}
              meta={<Docket items={[t('ovWhatsappDownMeta')]} />}
            />
          ) : null}
          {breaches > 0 ? (
            <AttentionRow
              level="critical"
              href="/dashboard/escalations"
              title={`${breaches} ${t('ovSlaBreached')}`}
              meta={<Docket items={[t('demoSlaTarget')]} />}
            />
          ) : null}
          {escalations.map((e) => (
            <AttentionRow
              key={e.id}
              level={escalationLevel(e)}
              href="/dashboard/escalations"
              title={`${e.client.name ?? e.client.waPhone} — ${t(`escTrigger${e.triggerType}`)}`}
              meta={<Docket items={[e.assignedTo?.name ?? t('demoUnassigned'), timeAgo(e.createdAt)]} />}
              trailing={<SlaClock deadline={e.slaDeadline} stopped={Boolean(e.acknowledgedAt)} />}
            />
          ))}
          {waitingList
            .filter((c) => !escalations.some((e) => e.conversationId === c.id))
            .slice(0, 6)
            .map((c) => (
              <AttentionRow
                key={c.id}
                level="attention"
                href={`/dashboard/inbox?conversation=${c.id}`}
                title={`${clientLabel(c.client)}${c.case ? ` — ${c.case.reference}` : ''}`}
                meta={
                  <Docket
                    items={[
                      c.assignedTo?.name ?? t('demoUnassigned'),
                      c.pendingDraft ? t('tlDraft') : null,
                      c.pendingPayment?.proofMessageId ? t('tlProof') : null,
                    ]}
                  />
                }
                trailing={
                  c.lastClientMessageAt ? (
                    <span className="docket text-muted-foreground">{timeAgo(c.lastClientMessageAt)}</span>
                  ) : null
                }
              />
            ))}
          {proofs.map((p) => (
            <AttentionRow
              key={p.id}
              level="attention"
              href="/dashboard/payments"
              title={`${formatMoney(p.amountCents)} ${t('demoProofToVerify')} — ${p.client?.name ?? p.client?.waPhone ?? ''}`}
              meta={<Docket items={[p.case?.reference, p.method.replace('_', ' ')]} />}
            />
          ))}
          {(docRequests.data ?? []).slice(0, 4).map((d) => (
            <AttentionRow
              key={d.id}
              level="routine"
              href="/dashboard/documents"
              title={`${d.description} — ${d.clientName ?? ''}`}
              meta={<Docket items={[d.caseReference, `${t('demoRequested')} ${timeAgo(d.createdAt)}`]} />}
            />
          ))}
          {overdue.map((p) => (
            <AttentionRow
              key={p.id}
              level="routine"
              href="/dashboard/payments"
              title={`${formatMoney(p.amountCents)} ${t('demoOverdueFrom')} ${p.client?.name ?? ''}`}
              meta={<Docket items={[p.case?.reference, `${t('demoRequested')} ${timeAgo(p.requestedAt)}`]} />}
            />
          ))}
          {!attentionPending && attentionCount === 0 ? (
            <div className="flex items-center gap-3 px-3 py-6">
              <CheckCircle2 className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t('allClear')}</p>
                <p className="text-[13px] text-muted-foreground">{t('allClearDetail')}</p>
              </div>
            </div>
          ) : null}
        </Panel>

        <div className="grid grid-cols-1 content-start gap-4">
          <Panel
            title={t('demoDiary')}
            meta={t('demoTodayTomorrow')}
            action={
              <Button nativeButton={false} variant="ghost" size="icon-sm" aria-label={t('calendar')} render={<Link href="/dashboard/calendar" />}>
                <CalendarDays aria-hidden />
              </Button>
            }
            bodyClassName="divide-y divide-border"
          >
            {appointmentsToday.isPending && hearingsSoon.isPending ? <RowsSkeleton rows={3} /> : null}
            {appointmentsToday.isSuccess && diary.length === 0 ? (
              <p className={cn('px-4 py-6 text-sm text-muted-foreground', urdu)}>{t('ovDiaryEmpty')}</p>
            ) : null}
            {diary.slice(0, 7).map((d) => {
              const tomorrow = d.at > endOfToday;
              return (
                <Link
                  key={d.key}
                  href={d.href}
                  className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-[13px] tabular-nums text-muted-foreground" suppressHydrationWarning>
                    {tomorrow ? <span className="block text-[10px] uppercase">{t('demoTmrw')}</span> : null}
                    {d.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{d.title}</span>
                    <Docket items={d.meta} />
                  </span>
                  {d.level === 'urgent' ? <Clock3 className="size-3.5 text-muted-foreground" aria-label={t('calendar')} /> : null}
                </Link>
              );
            })}
          </Panel>

          {canReadAnalytics ? (
            <Panel title={t('demoPipeline')} meta={t('demoLast30')} bodyClassName="px-4 py-4">
              {funnel.isPending ? (
                <Skeleton className="h-14 w-full" />
              ) : funnel.data ? (
                <ol className="grid grid-cols-3 gap-3">
                  {[
                    [t('ovConversations'), funnel.data.conversations],
                    [t('cases'), funnel.data.cases],
                    [t('ovPaidClients'), funnel.data.paidClients],
                  ].map(([label, value], i) => (
                    <li key={String(label)}>
                      <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
                      <Meter className="mt-2" value={Number(value)} max={Math.max(funnel.data.conversations, 1)} tone={i === 2 ? 'primary' : 'muted'} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t('couldntLoadMetrics')}</p>
              )}
            </Panel>
          ) : null}
        </div>
      </div>

      {canReadPayments ? (
        <Panel title={t('payments')} meta={t('demoLast30')} bodyClassName="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:divide-x-reverse">
          {[
            [t('demoCollected'), metrics.data?.feesCollectedCents30d, 'text-foreground'],
            [t('demoPending'), proofs.reduce((n, p) => n + p.amountCents, 0), 'text-attention'],
            [t('demoOverdue'), overdue.reduce((n, p) => n + p.amountCents, 0), 'text-critical'],
          ].map(([label, amount, tone]) => (
            <Link key={String(label)} href="/dashboard/payments" className="px-4 py-4 transition-colors hover:bg-muted/40">
              <p className="docket text-muted-foreground">{label}</p>
              <p className={cn('mt-1.5 font-mono text-lg font-medium tabular-nums', String(tone))}>
                {amount == null ? '—' : formatMoney(Number(amount))}
              </p>
            </Link>
          ))}
        </Panel>
      ) : null}

      {!isStaff ? <AiControls canManage={canManageFirm} /> : null}

      {canManageFirm && !launchDone && profile.isSuccess ? (
        <Panel
          title={t('launchPath')}
          meta={`${launchCompleted} / ${launchSteps.length}`}
          action={
            <Button nativeButton={false} variant="outline" size="sm" className="h-8" render={<Link href="/dashboard/setup" />}>
              {t('openSetupChecklist')}
            </Button>
          }
          bodyClassName="p-4"
        >
          <Meter value={launchCompleted} max={launchSteps.length} />
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {launchSteps.map((step) => (
              <li key={step.key} className="flex gap-2.5">
                <Signal level={launchState[step.key] ? 'ok' : 'info'} className="mt-1">
                  <span className="sr-only">{launchState[step.key] ? t('demoDone') : ''}</span>
                </Signal>
                <div>
                  <p className="text-[13px] font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
