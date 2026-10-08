import type { ReactNode } from 'react';
import Link from 'next/link';
import { signalRule, type SignalLevel } from '@/components/signal';
import { cn } from '@/lib/utils';

/**
 * One line of work, carrying its Chambers Signal as a start-edge rule. Used
 * by the overview attention board, the demo command center and the landing
 * preview so priority looks identical everywhere.
 */
export function AttentionRow({
  level,
  title,
  meta,
  trailing,
  href,
  onClick,
  className,
}: {
  level: SignalLevel;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium leading-5">{title}</div>
        {meta ? <div className="mt-0.5 truncate">{meta}</div> : null}
      </div>
      {trailing ? <div className="shrink-0 text-end">{trailing}</div> : null}
    </>
  );
  const classes = cn(
    'relative flex items-center gap-3 py-2.5 ps-4 pe-3',
    'before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full',
    signalRule(level),
    className,
  );
  const interactive = 'rounded-md transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, interactive, 'w-full text-start')}>
        {body}
      </button>
    );
  }
  return href ? (
    <Link
      href={href}
      className={cn(
        classes,
        'rounded-md transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
