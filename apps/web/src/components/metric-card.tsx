import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { signalRule, type SignalLevel } from '@/components/signal';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string | undefined;
  detail?: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  isPending?: boolean;
  /** @deprecated use `signal="ok"` */
  accent?: boolean;
  /** Chambers Signal — a coloured rule, so priority survives greyscale. */
  signal?: SignalLevel;
  spark?: number[];
  href?: string;
  onClick?: () => void;
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2 || points.every((p) => p === 0)) {
    return <div className="h-7" role="img" aria-label={`${label}: no data`} />;
  }
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(96 - (p / max) * 92).toFixed(2)}`)
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-7 w-full text-chart-1"
      role="img"
      aria-label={`${label}: ${points.length}-day trend`}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * KPI tile. Numbers are tabular; priority is carried by a start-edge signal
 * rule rather than an icon tile, so a critical metric outranks a routine one.
 */
export function MetricCard({
  title,
  value,
  detail,
  hint,
  icon: Icon,
  isPending,
  accent,
  signal,
  spark,
  href,
  onClick,
}: MetricCardProps) {
  const level: SignalLevel | undefined = signal ?? (accent ? 'ok' : undefined);
  const card = (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl bg-card p-4 ring-1 ring-border transition-colors',
        level && `before:absolute before:inset-y-0 before:start-0 before:w-[3px] ${signalRule(level)}`,
        (href || onClick) && 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
          <span className="line-clamp-2">{title}</span>
        </p>
        {href || onClick ? (
          <ArrowUpRight
            className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary rtl:-scale-x-100"
            aria-hidden
          />
        ) : null}
      </div>
      {isPending ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <div className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {value ?? '—'}
        </div>
      )}
      {detail ? <div className="mt-2 text-xs text-muted-foreground">{detail}</div> : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {spark && !isPending ? (
        <div className="mt-auto pt-3">
          <Sparkline points={spark} label={title} />
        </div>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full w-full rounded-xl text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {card}
      </button>
    );
  }
  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {card}
    </Link>
  ) : (
    card
  );
}
