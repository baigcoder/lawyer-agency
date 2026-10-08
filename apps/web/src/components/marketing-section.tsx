import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared section shell for the marketing pages. Owns the measure, vertical
 * rhythm, `scroll-mt-*` (anchored headings clear the sticky header) and the
 * three section tones: paper (default), sunken band, and the dark chambers
 * stage used for immersive product moments.
 */
export function Section({
  id,
  tone = 'default',
  size = 'default',
  className,
  innerClassName,
  children,
  labelledBy,
}: {
  id?: string;
  tone?: 'default' | 'muted' | 'stage';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'scroll-mt-16',
        tone === 'muted' && 'border-y border-border bg-sunken',
        tone === 'stage' && 'chambers-stage dark text-foreground',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8',
          size === 'sm' && 'py-12 sm:py-14',
          size === 'default' && 'py-20 sm:py-28',
          size === 'lg' && 'py-24 sm:py-32',
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Act label + editorial heading + optional lede. `index` renders the act
 * number in the docket ("02 · Matter formation").
 *
 * Urdu never takes the display serif: Nastaliq display sizes need explicit
 * leading because `.font-urdu` sets 2.2 for body copy.
 */
export function SectionHeading({
  id,
  index,
  eyebrow,
  title,
  lede,
  urdu,
  align = 'start',
  className,
}: {
  id?: string;
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: string;
  urdu?: boolean;
  align?: 'start' | 'center';
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? (
        <p className="docket text-primary">
          {index ? <span className="text-muted-foreground">{index} · </span> : null}
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={cn(
          'mt-4 text-balance',
          urdu
            ? 'font-urdu text-3xl leading-[1.75] sm:text-4xl sm:leading-[1.75]'
            : 'font-display text-[2.5rem] leading-[1.05] sm:text-[3.25rem]',
        )}
      >
        {title}
      </h2>
      {lede ? (
        <p className={cn('mt-5 text-pretty text-[1.0625rem] leading-8 text-muted-foreground', urdu && 'font-urdu')}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}
