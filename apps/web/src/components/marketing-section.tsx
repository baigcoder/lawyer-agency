import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared section shell for the marketing pages. Replaces the
 * `mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28` string that was repeated at
 * every landing section, and owns two things those copies kept getting wrong:
 * `scroll-mt-*` (so an anchored heading is not hidden under the sticky header)
 * and the muted band treatment used to separate adjacent sections.
 */
export function Section({
  id,
  tone = 'default',
  size = 'default',
  className,
  innerClassName,
  children,
}: {
  id?: string;
  tone?: 'default' | 'muted';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-16',
        tone === 'muted' && 'border-y border-border bg-muted/30',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto max-w-6xl px-4 sm:px-6',
          size === 'sm' && 'py-10 sm:py-12',
          size === 'default' && 'py-16 sm:py-24',
          size === 'lg' && 'py-16 sm:py-24 lg:py-28',
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Eyebrow + heading + optional lede. Every landing section repeated this
 * three-element pattern with slightly different spacing each time.
 *
 * `urdu` swaps in the Nastaliq face. Display sizes need an explicit
 * `leading-*` because `.font-urdu` sets `line-height: 2.1` (globals.css), which
 * is right for body copy but far too loose for a 36px heading.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  urdu,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  urdu?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow ? (
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.16em] text-primary',
            urdu && 'font-urdu tracking-normal',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'mt-3 text-3xl font-bold tracking-tight sm:text-4xl',
          urdu && 'font-urdu leading-[1.55] tracking-normal',
        )}
      >
        {title}
      </h2>
      {lede ? (
        <p className={cn('mt-4 text-lg leading-8 text-muted-foreground', urdu && 'font-urdu')}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}
