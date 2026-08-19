'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Inbox,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest, ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';
import {
  dailySeriesSchema,
  dashboardMetricsSchema,
  funnelSchema,
  revenueByAreaSchema,
  type DailySeriesPoint,
} from '@/lib/schemas/analytics';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type MetricKey = 'newConversations' | 'aiHandled' | 'humanHandled' | 'escalations' | 'casesOpened' | 'paymentsCents';

const METRIC_TABS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'newConversations', label: 'New leads', color: 'bg-primary' },
  { key: 'aiHandled', label: 'AI handled', color: 'bg-emerald-400' },
  { key: 'humanHandled', label: 'Human handled', color: 'bg-sky-400' },
  { key: 'escalations', label: 'Escalations', color: 'bg-amber-400' },
  { key: 'casesOpened', label: 'Cases opened', color: 'bg-violet-400' },
  { key: 'paymentsCents', label: 'Fees', color: 'bg-primary' },
];

function DailyBarChart({ series, metric }: { series: DailySeriesPoint[]; metric: MetricKey }) {
  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No data yet — metrics appear as clients message on WhatsApp.
      </div>
    );
  }
  const max = Math.max(...series.map((p) => Number(p[metric])), 1);
  const isMoney = metric === 'paymentsCents';
  return (
    <div className="space-y-2">
      <div className="flex h-40 items-end gap-1" role="img" aria-label={`30-day ${metric} trend`}>
        {series.map((p) => {
          const value = Number(p[metric]);
          const height = value === 0 ? 2 : Math.max(4, (value / max) * 100);
          return (
            <div
              key={p.date}
              title={`${p.date}: ${isMoney ? formatMoney(value) : value}`}
              className={cn(
                'flex-1 rounded-t-sm transition-all hover:opacity-80',
                METRIC_TABS.find((t) => t.key === metric)?.color ?? 'bg-primary',
                value === 0 && 'opacity-20',
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[Math.floor(series.length / 2)]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: { conversations: number; cases: number; paidClients: number } }) {
  const stages = [
    { label: 'Conversations', value: funnel.conversations, icon: Users },
    { label: 'Cases opened', value: funnel.cases, icon: Briefcase },
    { label: 'Paid clients', value: funnel.paidClients, icon: Wallet },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
          Conversion funnel
        </CardTitle>
        <CardDescription>WhatsApp chats → cases → clients who paid</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          const prev = i > 0 ? stages[i - 1].value : null;
          const rate = prev && prev > 0 ? ((stage.value / prev) * 100).toFixed(0) : null;
          return (
            <div key={stage.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <span className="font-medium">{stage.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {rate !== null && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {rate}%
                    </span>
                  )}
                  <span className="text-lg font-bold">{stage.value}</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${(stage.value / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RevenueCard({ revenue }: { revenue: Array<{ matterType: string; totalCents: number; paymentCount: number }> }) {
  const total = revenue.reduce((acc, r) => acc + r.totalCents, 0);
  const max = Math.max(...revenue.map((r) => r.totalCents), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" aria-hidden />
          Revenue by practice area
        </CardTitle>
        <CardDescription>Total collected: {formatMoney(total)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {revenue.slice(0, 6).map((row) => {
          const share = total > 0 ? Math.round((row.totalCents / total) * 100) : 0;
          return (
            <div key={row.matterType} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{row.matterType}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{row.paymentCount} payment{row.paymentCount === 1 ? '' : 's'}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{share}%</span>
                  <span className="font-semibold">{formatMoney(row.totalCents)}</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${(row.totalCents / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {revenue.length > 6 && (
          <p className="text-center text-xs text-muted-foreground">
            +{revenue.length - 6} more practice area{revenue.length - 6 === 1 ? '' : 's'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function heatColor(value: number, max: number): string {
  if (value === 0) return '';
  const intensity = value / max;
  if (intensity > 0.75) return 'bg-primary/30 text-primary-foreground';
  if (intensity > 0.4) return 'bg-primary/15';
  return 'bg-primary/5';
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [chartMetric, setChartMetric] = useState<MetricKey>('newConversations');

  const metrics = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => apiRequest('/v1/analytics/dashboard', { schema: dashboardMetricsSchema }),
  });
  const daily = useQuery({
    queryKey: ['analytics', 'daily', 30],
    queryFn: () => apiRequest('/v1/analytics/daily?days=30', { schema: dailySeriesSchema }),
  });
  const funnel = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => apiRequest('/v1/analytics/funnel', { schema: funnelSchema }),
  });
  const revenue = useQuery({
    queryKey: ['analytics', 'revenue-by-area'],
    queryFn: () => apiRequest('/v1/analytics/revenue-by-practice-area', { schema: revenueByAreaSchema }),
  });

  const series = daily.data ?? [];
  const sum = (key: keyof DailySeriesPoint) =>
    series.reduce((acc, p) => acc + (typeof p[key] === 'number' ? (p[key] as number) : 0), 0);

  const metricCards = [
    {
      title: 'New leads',
      subtitle: 'Last 7 days',
      value: metrics.data ? String(metrics.data.newLeads7d) : undefined,
      spark: series.slice(-7).map((p) => p.newConversations),
      total: sum('newConversations'),
      format: (n: number) => String(n),
      icon: Inbox,
    },
    {
      title: 'Escalations',
      subtitle: 'Last 7 days',
      value: metrics.data ? String(metrics.data.escalations7d) : undefined,
      spark: series.slice(-7).map((p) => p.escalations),
      total: sum('escalations'),
      format: (n: number) => String(n),
      icon: AlertTriangle,
    },
    {
      title: 'Cases opened',
      subtitle: 'Last 7 days',
      value: metrics.data ? String(metrics.data.casesOpened7d) : undefined,
      spark: series.slice(-7).map((p) => p.casesOpened),
      total: sum('casesOpened'),
      format: (n: number) => String(n),
      icon: Briefcase,
    },
    {
      title: 'Fees collected',
      subtitle: 'Last 30 days',
      value: metrics.data ? formatMoney(metrics.data.feesCollectedCents30d) : undefined,
      spark: series.slice(-30).map((p) => p.paymentsCents),
      total: sum('paymentsCents'),
      format: formatMoney,
      icon: Wallet,
    },
  ];

  const maxActivity = Math.max(...series.map((p) => p.newConversations + p.aiHandled + p.humanHandled + p.escalations + p.casesOpened), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title={t('analytics')}
        description={t('analyticsDescription')}
      />

      {(metrics.isError || daily.isError) && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load analytics.{' '}
          {metrics.error instanceof ApiError && metrics.error.correlationId && (
            <span className="ml-1 text-xs opacity-70">correlation id: {metrics.error.correlationId}</span>
          )}
        </div>
      )}

      {/* KPI cards with sparklines */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            isPending={metrics.isPending}
            detail={`${card.format(card.total)} in last 30 days`}
            spark={card.spark}
            icon={card.icon}
          />
        ))}
      </div>

      {/* 30-day chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Daily activity — last 30 days</CardTitle>
              <CardDescription>Select a metric to see its daily trend</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {METRIC_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setChartMetric(tab.key)}
                  aria-pressed={chartMetric === tab.key}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    chartMetric === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {daily.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <DailyBarChart series={series} metric={chartMetric} />
          )}
        </CardContent>
      </Card>

      {/* Funnel + Revenue */}
      {(funnel.data || (revenue.data && revenue.data.length > 0)) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {funnel.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : funnel.data ? (
            <FunnelCard funnel={funnel.data} />
          ) : null}
          {revenue.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : revenue.data && revenue.data.length > 0 ? (
            <RevenueCard revenue={revenue.data} />
          ) : null}
        </div>
      )}

      {/* Daily breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily breakdown</CardTitle>
          <CardDescription>Last 30 days · newest first · highlighted cells show above-average activity</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">AI</TableHead>
                <TableHead className="text-right">Human</TableHead>
                <TableHead className="text-right">Escal.</TableHead>
                <TableHead className="text-right">Cases</TableHead>
                <TableHead className="text-right">Fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.isPending ? (
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : series.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No activity recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                [...series].reverse().map((p) => {
                  const activity = p.newConversations + p.aiHandled + p.humanHandled + p.escalations + p.casesOpened;
                  return (
                    <TableRow key={p.date} className={cn(heatColor(activity, maxActivity))}>
                      <TableCell className="font-mono text-xs font-medium">{p.date}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {WEEKDAYS[new Date(`${p.date}T00:00:00Z`).getUTCDay()]}
                      </TableCell>
                      <TableCell className="text-right font-medium">{p.newConversations || '—'}</TableCell>
                      <TableCell className="text-right text-emerald-500">{p.aiHandled || '—'}</TableCell>
                      <TableCell className="text-right text-sky-500">{p.humanHandled || '—'}</TableCell>
                      <TableCell className={cn('text-right', p.escalations > 0 && 'font-semibold text-amber-500')}>
                        {p.escalations || '—'}
                      </TableCell>
                      <TableCell className="text-right">{p.casesOpened || '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {p.paymentsCents > 0 ? formatMoney(p.paymentsCents) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
