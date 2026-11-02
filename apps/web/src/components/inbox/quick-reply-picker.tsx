'use client';

import { useState, type KeyboardEvent, type RefObject } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { fillQuickReply, matchQuickReplies, nextPlaceholder, type QuickReplyValues } from '@/lib/quick-replies';
import { quickReplyListSchema, type QuickReply } from '@/lib/schemas/quick-replies';
import { cn } from '@/lib/utils';

export const QUICK_REPLIES_KEY = ['quick-replies'] as const;

export function useQuickReplyList(enabled = true) {
  return useQuery({
    queryKey: QUICK_REPLIES_KEY,
    queryFn: () => apiRequest('/v1/quick-replies', { schema: quickReplyListSchema }),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

function selectRange(el: HTMLTextAreaElement | null, range: { start: number; end: number } | null) {
  if (!el) return;
  el.focus();
  if (range) el.setSelectionRange(range.start, range.end);
}

/**
 * Slash-command quick replies for the inbox composer: typing "/" in an empty
 * box (or the ⚡ button) opens the list; ↑↓ to move, Enter/Tab to insert,
 * Esc to close. After insert the first unfilled {placeholder} is selected and
 * Tab hops to the next one, so the lawyer only types the blanks.
 */
export function useQuickReplyComposer({
  reply,
  setReply,
  textareaRef,
  values,
}: {
  reply: string;
  setReply: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  values: QuickReplyValues;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [viaSlash, setViaSlash] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useQuickReplyList();
  const matches = matchQuickReplies(list.data ?? [], query, language);

  function close() {
    setOpen(false);
    setViaSlash(false);
    setQuery('');
    setActive(0);
  }

  function pick(item: QuickReply) {
    const text = fillQuickReply(item.body, values);
    setReply(text);
    close();
    // Wait for React to render the new value before selecting inside it.
    requestAnimationFrame(() => selectRange(textareaRef.current, nextPlaceholder(text, 0)));
  }

  function onChange(value: string) {
    setReply(value);
    // "/hear" in an otherwise empty box searches; anything else ends a slash search.
    const slash = /^\/([^\n]*)$/.exec(value);
    if (slash) {
      setOpen(true);
      setViaSlash(true);
      setQuery(slash[1] ?? '');
      setActive(0);
    } else if (viaSlash) {
      close();
    }
  }

  /** Returns true when the key was handled here and the composer must not act on it. */
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (matches.length ? (i + step + matches.length) % matches.length : 0));
        return true;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        // Never send "/hearing" as a message: Enter with no match does nothing.
        e.preventDefault();
        const item = matches[active];
        if (item) pick(item);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        if (reply.startsWith('/')) setReply('');
        return true;
      }
      return false;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      const el = e.currentTarget;
      const next = nextPlaceholder(reply, el.selectionEnd);
      if (next) {
        e.preventDefault();
        selectRange(el, next);
        return true;
      }
    }
    return false;
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setQuery('');
    setActive(0);
    textareaRef.current?.focus();
  }

  const panel = open ? (
    <QuickReplyPanel
      items={matches}
      active={active}
      loading={list.isPending}
      empty={(list.data ?? []).length === 0}
      onHover={setActive}
      onPick={pick}
    />
  ) : null;

  return { open, panel, onChange, onKeyDown, toggle };
}

export function QuickReplyButton({ open, onClick, disabled }: { open: boolean; onClick: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      aria-label={t('quickReplies')}
      title={`${t('quickReplies')} ( / )`}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
        open && 'border-primary/40 bg-primary/10 text-primary',
      )}
    >
      <Zap className="size-4" aria-hidden />
    </button>
  );
}

function QuickReplyPanel({
  items,
  active,
  loading,
  empty,
  onHover,
  onPick,
}: {
  items: QuickReply[];
  active: number;
  loading: boolean;
  empty: boolean;
  onHover: (index: number) => void;
  onPick: (item: QuickReply) => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="listbox"
      aria-label={t('quickReplies')}
      className="mb-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="docket text-muted-foreground">{t('quickReplies')}</span>
        <span className="text-[11px] text-muted-foreground max-md:hidden">{t('quickRepliesKeys')}</span>
      </div>
      {loading ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">…</p>
      ) : empty ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t('quickRepliesNone')}{' '}
          <Link href="/dashboard/settings#quick-replies" className="font-medium text-primary underline-offset-2 hover:underline">
            {t('quickRepliesSetUp')}
          </Link>
        </p>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{t('quickRepliesNoMatch')}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto py-1">
          {items.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                // mousedown keeps focus in the textarea so the selection lands there.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
                onMouseEnter={() => onHover(index)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-start',
                  index === active ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {item.language === 'ur' ? 'اردو' : 'EN'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" dir="auto">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground" dir="auto">{item.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
