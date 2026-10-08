'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Re-renders every `intervalMs`; returns the current epoch ms. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Live escalation SLA. Mono + tabular so the digits never jitter; turns
 * critical in the last five minutes and shows "+mm:ss" once breached.
 */
export function SlaClock({
  deadline,
  stopped,
  className,
  label = 'SLA',
}: {
  deadline: number | Date;
  stopped?: boolean;
  className?: string;
  label?: string;
}) {
  const now = useNow();
  const end = typeof deadline === 'number' ? deadline : deadline.getTime();
  const remaining = (end - now) / 1000;
  const breached = remaining < 0;
  const tone = stopped ? 'text-muted-foreground' : breached || remaining < 300 ? 'text-critical' : remaining < 900 ? 'text-attention' : 'text-foreground/80';

  return (
    <span className={cn('font-mono text-[13px] tabular-nums', tone, className)} suppressHydrationWarning>
      {label ? `${label} ` : ''}
      {breached ? '+' : ''}
      {formatDuration(remaining)}
    </span>
  );
}
