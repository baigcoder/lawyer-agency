'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
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
} from '@/lib/schemas/escalations';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';

const POLL_MS = 5_000;

const tabs = [
  { labelKey: 'tabOpen', value: 'OPEN' },
  { labelKey: 'tabAcknowledged', value: 'ACKNOWLEDGED' },
  { labelKey: 'tabResolved', value: 'RESOLVED' },
  { labelKey: 'tabAll', value: 'ALL' },
] as const;

const statusVariant: Record<EscalationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'destructive',
  ACKNOWLEDGED: 'default',
  RESOLVED: 'secondary',
};

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
      toast.success('Escalation resolved.');
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not resolve.'),
  });

  const openCount = tab === 'OPEN' ? (list.data?.length ?? 0) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('escalations')}
        description={t('escalationsDescription')}
        icon={AlertTriangle}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tabItem) => (
          <Button
            key={tabItem.value}
            type="button"
            size="sm"
            variant={tab === tabItem.value ? 'default' : 'outline'}
            onClick={() => setTab(tabItem.value)}
          >
            {t(tabItem.labelKey)}
            {tabItem.value === 'OPEN' && openCount !== undefined && openCount > 0 ? (
              <Badge variant="secondary" className="ml-2">{openCount}</Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {list.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load escalations: {list.error instanceof ApiError ? list.error.message : 'unknown error'}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : null}

      {list.isSuccess && list.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            No {tab === 'ALL' ? '' : tab.toLowerCase()} escalations — your team is caught up.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
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
  return (
    <Card className={item.slaBreached ? 'border-destructive/50' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {item.slaBreached ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
              {triggerLabels[item.triggerType]}
            </CardTitle>
            <CardDescription className="mt-1">
              {item.client.name ?? item.client.waPhone} · {timeAgo(item.createdAt)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant[item.status]}>{item.status.toLowerCase()}</Badge>
            {item.slaBreached ? <Badge variant="destructive">SLA breached</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <HandoffBriefView
          reason={item.handoffReason}
          excerpt={item.detectedExcerpt}
          brief={item.handoffBrief}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>SLA: {item.slaDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {item.assignedTo ? <span>Assigned: {item.assignedTo.name}</span> : <span>Unassigned</span>}
          {item.acknowledgerName ? <span>Acknowledged by {item.acknowledgerName}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/dashboard/inbox?conversation=${item.conversationId}`} />}>
            <ExternalLink className="mr-1 h-3 w-3" /> Open inbox
          </Button>
          {item.status === 'OPEN' ? (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onAcknowledge}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Acknowledge
            </Button>
          ) : null}
          {item.status !== 'RESOLVED' ? (
            <Button type="button" size="sm" disabled={busy} onClick={onResolve}>
              Mark resolved
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
