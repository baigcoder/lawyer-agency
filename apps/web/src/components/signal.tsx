import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chambers Signal — the single priority vocabulary used across marketing, demo
 * and dashboard. Colour is restricted to three meanings (red critical, amber
 * attention, emerald verified); everything else is graphite so the hierarchy
 * still reads in greyscale (critical/urgent are filled, the rest are not).
 */
export type SignalLevel = 'critical' | 'urgent' | 'attention' | 'routine' | 'info' | 'ok';

const dot: Record<SignalLevel, string> = {
  critical: 'bg-critical',
  urgent: 'bg-transparent ring-[1.5px] ring-inset ring-critical',
  attention: 'bg-attention',
  routine: 'bg-muted-foreground/60',
  info: 'bg-transparent ring-1 ring-inset ring-muted-foreground/60',
  ok: 'bg-primary',
};

const text: Record<SignalLevel, string> = {
  critical: 'text-critical',
  urgent: 'text-critical',
  attention: 'text-attention',
  routine: 'text-muted-foreground',
  info: 'text-muted-foreground',
  ok: 'text-primary',
};

export function SignalDot({ level, className }: { level: SignalLevel; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', dot[level], className)} />;
}

/** Dot + docket-style label, e.g. "● URGENT". */
export function Signal({
  level,
  children,
  className,
}: {
  level: SignalLevel;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('docket inline-flex items-center gap-1.5', text[level], className)}>
      <SignalDot level={level} />
      {children}
    </span>
  );
}

/** Vertical rule used on rows/panels to carry their signal without a badge. */
export function signalRule(level: SignalLevel): string {
  return {
    critical: 'before:bg-critical',
    urgent: 'before:bg-critical/60',
    attention: 'before:bg-attention',
    routine: 'before:bg-border',
    info: 'before:bg-transparent',
    ok: 'before:bg-primary',
  }[level];
}

/**
 * Docket line — mono, tracked metadata separated by middots. Matter IDs,
 * courts, timestamps and money are always set in this face.
 */
export function Docket({ items, className }: { items: Array<ReactNode | null | undefined | false>; className?: string }) {
  const parts = items.filter((item): item is ReactNode => item != null && item !== false && item !== '');
  return (
    <span className={cn('docket inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground', className)}>
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="opacity-50">·</span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}
