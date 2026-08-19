import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string | undefined;
  detail?: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  isPending?: boolean;
  accent?: boolean;
  spark?: number[];
  href?: string;
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2 || points.every((p) => p === 0)) {
    return <div className="h-8" role="img" aria-label={`${label}: no data`} />;
  }
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(100 - (p / max) * 100).toFixed(2)}`)
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-8 w-full text-primary/70"
      role="img"
      aria-label={`${label}: ${points.length}-day trend`}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  detail,
  hint,
  icon: Icon,
  isPending,
  accent,
  spark,
  href,
}: MetricCardProps) {
  const card = (
    <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {href ? <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden /> : null}
            {Icon && (
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors',
                  accent
                    ? 'bg-primary/10 text-primary ring-primary/20'
                    : 'bg-muted text-muted-foreground ring-border group-hover:bg-primary/5 group-hover:text-primary',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
        {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {spark && !isPending ? (
          <div className="mt-3">
            <Sparkline points={spark} label={title} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  ) : card;
}
