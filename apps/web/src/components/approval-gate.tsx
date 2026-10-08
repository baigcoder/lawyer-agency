'use client';

import type { ReactNode } from 'react';
import { Check, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/**
 * Approval Gate — the frame every AI-drafted outbound sits in until a lawyer
 * approves it. Dashed border = "not yet sent"; the approve button is the only
 * filled action, so the consequential step is unambiguous.
 *
 * Presentational: the inbox wires real handlers; marketing/demo pass none and
 * the buttons stay inert (`demo`).
 */
export function ApprovalGate({
  title,
  meta,
  children,
  onApprove,
  onEdit,
  approveDisabled,
  approvePending,
  demo,
  emphasize,
  className,
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  onApprove?: () => void;
  onEdit?: () => void;
  approveDisabled?: boolean;
  approvePending?: boolean;
  demo?: boolean;
  /** Gently pulses the approve action (marketing only). */
  emphasize?: boolean;
  className?: string;
}) {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  return (
    <section
      aria-label={title ?? t('gateTitle')}
      className={cn(
        'rounded-xl border border-dashed border-attention/60 bg-attention/[0.04] p-3',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="docket text-attention">
          {title ?? t('gateTitle')}
        </p>
        {meta ? <span className="docket text-muted-foreground">{meta}</span> : null}
      </header>
      <div className="mt-2 rounded-lg bg-card px-3 py-2.5 text-[13px] leading-relaxed ring-1 ring-border">
        {children}
      </div>
      <footer className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className={cn('h-8 px-3', emphasize && 'gate-attract')}
          onClick={onApprove}
          disabled={approveDisabled || approvePending}
          tabIndex={demo ? -1 : undefined}
          aria-hidden={demo || undefined}
        >
          <Check aria-hidden />
          <span className={urdu}>{t('approveSend')}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2.5 text-muted-foreground"
          onClick={onEdit}
          tabIndex={demo ? -1 : undefined}
          aria-hidden={demo || undefined}
        >
          <PencilLine aria-hidden />
          <span className={urdu}>{t('gateEdit')}</span>
        </Button>
        <span className={cn('ms-auto text-xs text-muted-foreground', urdu)}>{t('gateHeld')}</span>
      </footer>
    </section>
  );
}
