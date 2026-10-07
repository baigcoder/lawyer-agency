'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  ShieldAlert,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, ApiError } from '@/lib/api-client';
import { timeAgo } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { PageHeader } from '@/components/page-header';
import {
  escalationListSchema,
  escalationSummarySchema,
  triggerLabels,
  type EscalationStatus,
  type EscalationSummary,
  type EscalationTrigger,
} from '@/lib/schemas/escalations';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';

const POLL_MS = 5_000;

const tabs = [
  { labelKey: 'tabOpen', value: 'OPEN' },
  { labelKey: 'tabAcknowledged', value: 'ACKNOWLEDGED' },
  { labelKey: 'tabResolved', value: 'RESOLVED' },
  { labelKey: 'tabAll', value: 'ALL' },
] as const;

function triggerUrgency(trigger: EscalationTrigger): {
  level: 'CRITICAL' | 'HIGH' | 'NORMAL';
  label: string;
  badgeClass: string;
} {
  switch (trigger) {
    case 'SELF_HARM':
    case 'DOMESTIC_VIOLENCE':
      return {
        level: 'CRITICAL',
        label: 'Critical Emergency',
        badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
      };
    case 'ACTIVE_ARREST':
      return {
        level: 'CRITICAL',
        label: 'Active Arrest / Custody',
        badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
      };
    case 'IMMINENT_DEADLINE':
      return {
        level: 'HIGH',
        label: 'Filing Deadline',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    default:
      return {
        level: 'NORMAL',
        label: 'Legal Triage',
        badgeClass: 'bg-primary/10 text-primary border-primary/25',
      };
  }
}

function SlaCountdown({ deadline, breached }: { deadline: Date; breached: boolean }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    function calculate() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0 || breached) {
        setTimeLeft('SLA Breached');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s remaining`);
    }
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [deadline, breached]);

  if (breached) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        <Flame className="h-3 w-3" />
        SLA Breached
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
      <Clock className="h-3 w-3" />
      {timeLeft}
    </span>
  );
}

export default function EscalationsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<EscalationStatus | 'ALL'>('OPEN');
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['escalations', tab],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tab !== 'ALL') params.set('status', tab);
      return apiRequest(`/v1/escalations?${params.toString()}`, { schema: escalationListSchema });
    },
    refetchInterval: POLL_MS,
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/escalations/${id}/acknowledge`, { method: 'POST', schema: escalationSummarySchema }),
    onSuccess: () => {
      toast.success('Escalation acknowledged.');
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not acknowledge.'),
  });

  const resolve = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/escalations/${id}/resolve`, { method: 'POST', schema: escalationSummarySchema }),
    onSuccess: () => {
      toast.success('Escalation marked resolved.');
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not resolve.'),
  });

  const items = list.data ?? [];
  const openCount = items.filter((i) => i.status === 'OPEN').length;
  const breachedCount = items.filter((i) => i.slaBreached && i.status !== 'RESOLVED').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={t('escalations')}
        description="High-priority intake events requiring immediate advocate intervention and legal triage."
        icon={ShieldAlert}
      />

      {/* Triage Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Escalations
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{openCount}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            SLA Breaches
          </span>
          <p className={itemCountColor(breachedCount)}>
            {breachedCount}
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Response Target
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-primary">15 min</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {tabs.map((tabItem) => (
          <Button
            key={tabItem.value}
            type="button"
            size="sm"
            variant={tab === tabItem.value ? 'default' : 'outline'}
            onClick={() => setTab(tabItem.value)}
            className="h-8 text-xs"
          >
            {t(tabItem.labelKey)}
            {tabItem.value === 'OPEN' && openCount > 0 ? (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] leading-none">
                {openCount}
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {list.isError ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Couldn&apos;t load escalations: {list.error instanceof ApiError ? list.error.message : 'unknown error'}
        </div>
      ) : null}

      {list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {list.isSuccess && list.data.length === 0 ? (
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">No active escalations</p>
              <p className="mt-1 max-w-sm mx-auto text-muted-foreground">
                All high-priority inquiries have been reviewed or resolved. Your firm is caught up.
              </p>
            </div>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href="/dashboard/inbox" />}
              className="mt-2 text-xs"
            >
              Open Inbox <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {(list.data ?? []).map((item) => (
          <EscalationCard
            key={item.id}
            item={item}
            onAcknowledge={() => acknowledge.mutate(item.id)}
            onResolve={() => resolve.mutate(item.id)}
            busy={acknowledge.isPending || resolve.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function itemCountColor(count: number): string {
  if (count > 0) return 'mt-1 text-2xl font-bold tracking-tight text-destructive';
  return 'mt-1 text-2xl font-bold tracking-tight text-muted-foreground';
}

function EscalationCard({
  item,
  onAcknowledge,
  onResolve,
  busy,
}: {
  item: EscalationSummary;
  onAcknowledge: () => void;
  onResolve: () => void;
  busy: boolean;
}) {
  const urgency = triggerUrgency(item.triggerType);

  return (
    <Card className={item.slaBreached ? 'border-destructive/50 bg-destructive/5 shadow-2xs' : 'border-border/80 shadow-2xs'}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={urgency.badgeClass}>
                {urgency.label}
              </Badge>
              <CardTitle className="text-base font-semibold">
                {triggerLabels[item.triggerType]}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground">{item.client.name ?? item.client.waPhone}</span>
              <span>·</span>
              <span>{timeAgo(item.createdAt)}</span>
              {item.assignedTo && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {item.assignedTo.name}
                  </span>
                </>
              )}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <SlaCountdown deadline={item.slaDeadline} breached={item.slaBreached} />
            <Badge
              variant={
                item.status === 'OPEN'
                  ? 'destructive'
                  : item.status === 'ACKNOWLEDGED'
                    ? 'default'
                    : 'secondary'
              }
              className="text-[10px] uppercase font-mono py-0.5"
            >
              {item.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <HandoffBriefView
          reason={item.handoffReason}
          excerpt={item.detectedExcerpt}
          brief={item.handoffBrief}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <div className="text-[11px] text-muted-foreground">
            {item.acknowledgerName ? (
              <span>Acknowledged by <strong className="text-foreground">{item.acknowledgerName}</strong></span>
            ) : (
              <span>Awaiting advocate acknowledgment</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              render={<Link href={`/dashboard/inbox?conversation=${item.conversationId}`} />}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in Inbox
            </Button>
            {item.status === 'OPEN' ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={onAcknowledge}
                className="h-8 text-xs"
              >
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Acknowledge &amp; Claim
              </Button>
            ) : null}
            {item.status !== 'RESOLVED' ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onResolve}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Mark Resolved
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
