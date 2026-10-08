'use client';

import type { ReactNode } from 'react';
import { Bot, FileText, ImageIcon, Lock, Mic, UserCheck } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export type TimelineSender = 'client' | 'ai' | 'lawyer' | 'note' | 'system';

const URDU = /[؀-ۿ]/;

/**
 * One entry in the conversation timeline. Provenance is carried by layout
 * and label, not by colour: client on the start side; Wakeel AI graphite
 * with its source; lawyers emerald with their name; internal notes as amber
 * memos that visibly never leave the firm; system events as docket chips.
 */
export function TimelineMessage({
  from,
  body,
  time,
  meta,
  author,
  kind,
  attachment,
  status,
}: {
  from: TimelineSender;
  body: ReactNode;
  time: string;
  meta?: string;
  author?: string;
  kind?: 'voice' | 'image' | 'document';
  attachment?: string;
  status?: ReactNode;
}) {
  const { t } = useLanguage();
  const text = typeof body === 'string' ? body : '';
  const urduText = URDU.test(text);

  if (from === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="docket inline-flex max-w-[90%] items-center gap-2 rounded-full bg-muted px-3 py-1 text-center text-muted-foreground">
          <span className="truncate">{body}</span>
          <span className="opacity-60">{time}</span>
        </span>
      </div>
    );
  }

  if (from === 'note') {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-lg border-s-2 border-attention bg-attention/[0.06] px-3.5 py-2.5">
        <p className="docket flex items-center gap-1.5 text-attention">
          <Lock className="size-3" aria-hidden />
          {t('tlInternalNote')} · {author}
          <span className="ms-auto text-muted-foreground">{time}</span>
        </p>
        <p dir="auto" className="mt-1 text-[13px] leading-relaxed">{body}</p>
      </div>
    );
  }

  const client = from === 'client';
  const label =
    from === 'ai' ? (
      <>
        <Bot className="size-3" aria-hidden />
        Wakeel AI
      </>
    ) : from === 'lawyer' ? (
      <>
        <UserCheck className="size-3" aria-hidden />
        {author}
      </>
    ) : null;

  return (
    <div className={cn('flex flex-col', client ? 'items-start' : 'items-end')}>
      {label ? (
        <p className={cn('docket mb-1 flex items-center gap-1.5', from === 'lawyer' ? 'text-primary' : 'text-muted-foreground')}>
          {label}
          {meta ? <span className="normal-case tracking-normal text-muted-foreground">· {meta}</span> : null}
        </p>
      ) : null}
      <div
        className={cn(
          'max-w-[min(34rem,86%)] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
          client && 'rounded-ss-md bg-card ring-1 ring-border',
          from === 'ai' && 'rounded-se-md bg-muted ring-1 ring-border',
          from === 'lawyer' && 'rounded-se-md bg-[var(--wa-firm)] ring-1 ring-primary/20',
        )}
      >
        {kind === 'voice' ? (
          <p className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Mic className="size-3.5" aria-hidden />
            {meta ?? t('inboxVoiceNote')}
          </p>
        ) : null}
        {kind === 'image' || kind === 'document' ? (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-background px-2.5 py-2 text-xs ring-1 ring-border">
            {kind === 'image' ? <ImageIcon className="size-4 text-muted-foreground" aria-hidden /> : <FileText className="size-4 text-muted-foreground" aria-hidden />}
            <span className="truncate font-mono">{attachment ?? meta}</span>
          </p>
        ) : null}
        <p dir="auto" className={cn(urduText && 'font-urdu text-[15px] leading-[2.1]')}>{body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {time}
          {status}
        </p>
      </div>
      {client && meta && !kind ? <p className="docket mt-1 text-muted-foreground">{meta}</p> : null}
    </div>
  );
}
