'use client';

import Link from 'next/link';
import { Briefcase, TrendingUp, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export function FunnelStrip({
  funnel,
  revenue,
  aiHandled,
  humanHandled,
  isPending,
  isError,
}: {
  funnel: { conversations: number; cases: number; paidClients: number } | undefined;
  revenue: Array<{ matterType: string; totalCents: number; paymentCount: number }> | undefined;
  aiHandled: number;
  humanHandled: number;
  isPending: boolean;
  isError: boolean;
}) {
  const { t } = useLanguage();
  const stages = [
    { label: t('funnelChats'), value: funnel?.conversations ?? 0, icon: Users },
    { label: t('funnelCases'), value: funnel?.cases ?? 0, icon: Briefcase },
    { label: t('funnelPaid'), value: funnel?.paidClients ?? 0, icon: Wallet },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  const topRevenue = (revenue ?? []).slice(0, 3);
  const handled = aiHandled + humanHandled;
  const aiShare = handled > 0 ? Math.round((aiHandled / handled) * 100) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              {t('pipelineHealth')}
            </CardTitle>
            <CardDescription>{t('pipelineHealthDetail')}</CardDescription>
          </div>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/analytics" />}>
            {t('openAnalytics')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}
        {isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('couldntLoadMetrics')}
          </p>
        ) : null}
        {!isPending && !isError ? (
          <>
            <div className="space-y-2">
              {stages.map((stage, i) => {
                const Icon = stage.icon;
                const prev = i > 0 ? stages[i - 1].value : null;
                const rate = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null;
                return (
                  <div key={stage.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {stage.label}
                      </span>
                      <span className="font-medium">
                        {stage.value}
                        {rate !== null ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{rate}%</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(stage.value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {t('aiVsHuman')}: {aiShare === null ? '—' : `${aiShare}% ${t('aiShare')}`}
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('topPracticeAreas')}</p>
              {topRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noRevenueYet')}</p>
              ) : (
                <ul className="space-y-2">
                  {topRevenue.map((row) => {
                    const shareMax = Math.max(...topRevenue.map((r) => r.totalCents), 1);
                    return (
                      <li key={row.matterType} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{row.matterType}</span>
                          <span className="shrink-0 font-medium">{formatMoney(row.totalCents)}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full bg-primary/70')}
                            style={{ width: `${(row.totalCents / shareMax) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
