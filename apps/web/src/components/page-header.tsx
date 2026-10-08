import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Docket line above the title, e.g. "Chambers · 12 open matters". */
  eyebrow?: ReactNode;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  action?: ReactNode;
  className?: string;
}

/**
 * Workspace header. Operational, not decorative: a docket eyebrow (icon +
 * context), a firm sans title and the page's primary action — no icon tile.
 */
export function PageHeader({ title, description, eyebrow, icon: Icon, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {Icon || eyebrow ? (
          <p className="docket mb-2 flex items-center gap-1.5 text-muted-foreground">
            {Icon ? <Icon className="size-3.5 text-primary" aria-hidden /> : null}
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
