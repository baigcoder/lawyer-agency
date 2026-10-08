import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Workspace panel — the dashboard's basic container. Flat surface, hairline
 * ring, a compact title row. Replaces ad-hoc Card stacks so every workspace
 * shares one density and one header rhythm.
 */
export function Panel({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id && title ? `${id}-title` : undefined}
      className={cn('flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border', className)}
    >
      {title || action ? (
        <header className="flex min-h-11 items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 id={id ? `${id}-title` : undefined} className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">
                {title}
              </h2>
            ) : null}
            {meta ? <div className="docket mt-0.5 truncate text-muted-foreground">{meta}</div> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Initials avatar. Graphite for clients, emerald for firm members — never a
 * per-person rainbow colour (the old WhatsApp-style hash palette).
 */
export function PersonAvatar({
  initials,
  firm,
  size = 'md',
  className,
}: {
  initials: string;
  firm?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        size === 'sm' && 'size-6 text-[10px]',
        size === 'md' && 'size-8 text-[11px]',
        size === 'lg' && 'size-10 text-xs',
        firm ? 'bg-primary/12 text-primary ring-1 ring-primary/25' : 'bg-muted text-foreground/75 ring-1 ring-border',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /[A-Za-z؀-ۿ]/.test(part[0] ?? ''))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Thin horizontal meter (share of a whole). */
export function Meter({ value, max = 100, tone = 'primary', className }: { value: number; max?: number; tone?: 'primary' | 'muted' | 'attention' | 'critical'; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span aria-hidden className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <span
        className={cn(
          'block h-full rounded-full transition-[width] duration-700',
          tone === 'primary' && 'bg-primary',
          tone === 'muted' && 'bg-muted-foreground/45',
          tone === 'attention' && 'bg-attention',
          tone === 'critical' && 'bg-critical',
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
