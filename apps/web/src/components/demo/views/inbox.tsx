'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, CheckCheck, FilePlus2, FolderOpen, Mic, PanelRightOpen, Search, Send, StickyNote, X } from 'lucide-react';
import { ApprovalGate } from '@/components/approval-gate';
import { useDemo } from '@/components/demo/demo-context';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { TimelineMessage } from '@/components/inbox/timeline-message';
import { Docket, Signal, SignalDot, signalRule } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PersonAvatar, initialsFrom } from '@/components/workspace/panel';
import { SlaClock } from '@/components/workspace/sla-clock';
import { CASES, type DemoConversation } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

type Filter = 'lawyer' | 'ai' | 'all';
const FILTERS: Array<{ value: Filter; key: TranslationKey }> = [
  { value: 'lawyer', key: 'inboxTabNeedsHuman' },
  { value: 'ai', key: 'inboxTabAiActive' },
  { value: 'all', key: 'inboxTabAll' },
];

const stateLabel: Record<DemoConversation['state'], TranslationKey> = {
  HUMAN_REQUIRED: 'inboxTabNeedsHuman',
  AI_ACTIVE: 'inboxTabAiActive',
  HUMAN_ACTIVE: 'inboxTabHumanActive',
  CLOSED: 'inboxTabClosed',
};

/** Inbox — list · timeline · matter context. Mobile is single-task. */
export function InboxView() {
  const { t } = useLanguage();
  const { conversations, selectedConversation, setSelectedConversation, markRead, arrivedId, typing } = useDemo();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [contextOpen, setContextOpen] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === 'lawyer' ? c.state === 'HUMAN_REQUIRED' || c.state === 'HUMAN_ACTIVE' : filter === 'ai' ? c.state === 'AI_ACTIVE' : true))
      .filter((c) => !q || `${c.client} ${c.caseRef ?? ''} ${c.preview}`.toLowerCase().includes(q));
  }, [conversations, filter, query]);

  const active = conversations.find((c) => c.id === selectedConversation) ?? null;

  // A message landing in the open thread is read on arrival.
  useEffect(() => {
    if (active?.unread) markRead(active.id);
  }, [active, markRead]);

  // Desktop opens on the most urgent conversation; mobile starts at the list.
  useEffect(() => {
    if (selectedConversation || !window.matchMedia('(min-width: 768px)').matches) return;
    const rank = { critical: 0, urgent: 1, attention: 2, routine: 3, ok: 4, info: 5 } as const;
    const first = [...conversations].sort((a, b) => rank[a.signal] - rank[b.signal])[0];
    setSelectedConversation(first?.id ?? null);
  }, [selectedConversation, conversations, setSelectedConversation]);

  return (
    <div className="flex h-[calc(100svh-5.75rem-3.5rem)] min-h-0 lg:h-[calc(100svh-5.75rem)]">
      {/* List */}
      <section
        aria-label={t('inbox')}
        className={cn('flex w-full min-w-0 shrink-0 flex-col border-e border-border bg-sunken/60 md:w-[330px] xl:w-[360px]', active && 'max-md:hidden')}
      >
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-baseline justify-between px-1">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{t('inbox')}</h1>
            <span className="docket text-muted-foreground">{list.length} · WhatsApp</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('inboxSearchPlaceholder')} aria-label={t('inboxSearchPlaceholder')} className="h-8 bg-background ps-8 text-[13px]" />
          </div>
          <div role="tablist" aria-label={t('inbox')} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                type="button"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'truncate rounded-md px-2 py-1 text-xs transition-colors',
                  filter === f.value ? 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {list.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t('inboxNoConversations')}</li>
          ) : null}
          {list.map((c) => {
            const selected = c.id === selectedConversation;
            const flagged = c.signal === 'critical' || c.signal === 'urgent' || c.signal === 'attention';
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConversation(c.id);
                    markRead(c.id);
                  }}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'relative grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg px-3 py-2.5 text-start transition-colors',
                    flagged && `before:absolute before:inset-y-3 before:start-0 before:w-[2.5px] before:rounded-full ${signalRule(c.signal)}`,
                    selected ? 'bg-background shadow-xs ring-1 ring-border' : 'hover:bg-background/70',
                    c.id === arrivedId && 'row-arrive',
                  )}
                >
                  <PersonAvatar initials={initialsFrom(c.client)} />
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-[13.5px]', c.unread ? 'font-semibold' : 'font-medium')}>{c.client}</span>
                      <span className={cn('shrink-0 font-mono text-[11px] tabular-nums', c.unread ? 'text-primary' : 'text-muted-foreground')}>{c.time}</span>
                    </span>
                    <span dir="auto" className={cn('mt-0.5 flex items-center gap-1 truncate text-[12.5px]', c.unread ? 'text-foreground/85' : 'text-muted-foreground')}>
                      {typing?.id === c.id ? (
                        <span className="truncate text-primary">{typing.who === 'ai' ? t('demoAiWriting') : t('demoTyping')}</span>
                      ) : (
                        <>
                          {c.preview.startsWith('Voice note') ? <Mic className="size-3 shrink-0" aria-hidden /> : null}
                          <span className="truncate">{c.preview}</span>
                        </>
                      )}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <Docket items={[c.caseRef, c.assignee?.split(' ')[0]]} className="min-w-0 flex-1 truncate" />
                      {c.draft ? <span className="docket rounded bg-attention/12 px-1.5 text-attention">{t('tlDraft')}</span> : null}
                      {c.paymentProof ? <span className="docket rounded bg-primary/10 px-1.5 text-primary">{t('tlProof')}</span> : null}
                      {c.unread ? <span className="min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-[11px] leading-5 text-primary-foreground">{c.unread}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Timeline */}
      {active ? (
        <Thread key={active.id} conversation={active} onBack={() => setSelectedConversation(null)} onContext={() => setContextOpen(true)} stateKey={stateLabel[active.state]} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
          <p className="font-display text-3xl">{t('tlSelectTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('tlSelectDesc')}</p>
        </div>
      )}

      {/* Context */}
      {active ? (
        <>
          <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-s border-border bg-card xl:block">
            <MatterContext conversation={active} />
          </aside>
          {contextOpen ? (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 xl:hidden" onClick={() => setContextOpen(false)}>
              <aside
                className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                aria-label={t('tlMatterContext')}
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <p className="docket text-muted-foreground">{t('tlMatterContext')}</p>
                  <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={() => setContextOpen(false)}>
                    <X aria-hidden />
                  </Button>
                </div>
                <MatterContext conversation={active} />
              </aside>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Thread({
  conversation: c,
  onBack,
  onContext,
  stateKey,
}: {
  conversation: DemoConversation;
  onBack: () => void;
  onContext: () => void;
  stateKey: TranslationKey;
}) {
  const { t } = useLanguage();
  const { approveDraft, sendMessage, go, typing } = useDemo();
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  // A draft can arrive live while the thread is open, so only edits are state.
  const [draftEdit, setDraftText] = useState<string | null>(null);
  const draftText = draftEdit ?? c.draft ?? '';
  const typingHere = typing?.id === c.id ? typing.who : null;
  const endRef = useRef<HTMLDivElement>(null);
  const [windowEnd] = useState(() => Date.now() + (23 * 3600 + 14 * 60) * 1000);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [c.id, c.messages.length, typingHere, c.draft]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    sendMessage(c.id, body, mode === 'note');
    setText('');
  };

  return (
    <section aria-label={c.client} className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-14 items-center gap-3 border-b border-border px-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t('tlBack')} onClick={onBack}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
        </Button>
        <PersonAvatar initials={initialsFrom(c.client)} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {c.client}
            {c.caseRef ? (
              <button type="button" onClick={() => go('cases', { caseRef: c.caseRef })} className="docket rounded bg-muted px-1.5 text-foreground/80 hover:bg-accent hover:text-accent-foreground">
                {c.caseRef}
              </button>
            ) : null}
          </p>
          <Docket items={[c.phone, c.language, c.assignee]} />
        </div>
        <Signal level={c.signal === 'info' ? 'routine' : c.signal} className="hidden sm:inline-flex">
          {t(stateKey)}
        </Signal>
        <Button variant="outline" size="sm" className="h-8 xl:hidden" onClick={onContext}>
          <PanelRightOpen className="rtl:-scale-x-100" aria-hidden />
          <span className="hidden sm:inline">{t('tlMatterContext')}</span>
        </Button>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-border bg-sunken/60 px-4 py-1.5">
        <span className="docket truncate text-muted-foreground">{t('tlWindowOpen')}</span>
        <SlaClock deadline={windowEnd} label="" className="text-xs" />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6">
        <p className="docket text-center text-muted-foreground">{t('today')}</p>
        {c.messages.map((m) => (
          <TimelineMessage
            key={m.id}
            from={m.from}
            body={m.body}
            time={m.time}
            meta={m.meta}
            author={m.author}
            kind={m.kind}
            status={m.from === 'lawyer' || m.from === 'ai' ? <CheckCheck className="size-3 text-primary" aria-hidden /> : undefined}
          />
        ))}
        {typingHere ? (
          <div className={cn('flex', typingHere === 'ai' && 'justify-end')} aria-live="polite">
            <span
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 ring-1',
                typingHere === 'ai' ? 'rounded-se-sm bg-[var(--wa-firm)] ring-primary/15' : 'rounded-ss-sm bg-card ring-border',
              )}
            >
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={cn('typing-dot size-1.5 rounded-full', typingHere === 'ai' ? 'bg-primary' : 'bg-muted-foreground')} style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
              <span className="text-[11px] text-muted-foreground">{typingHere === 'ai' ? t('demoAiWriting') : t('demoTyping')}</span>
            </span>
          </div>
        ) : null}
        {c.draft ? (
          <div className="ms-auto max-w-[min(34rem,92%)]">
            <ApprovalGate
              meta={`${c.caseRef ?? ''} · ${t('mfToClient')}`}
              onApprove={() => approveDraft(c.id, draftText.trim() || c.draft || '')}
              onEdit={() => setEditing((v) => !v)}
              approveDisabled={!draftText.trim()}
            >
              {editing ? (
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  aria-label={t('gateEdit')}
                  className="min-h-24 border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0"
                  autoFocus
                />
              ) : (
                <span dir="auto" className="block">{draftText}</span>
              )}
            </ApprovalGate>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className={cn('border-t border-border p-3', mode === 'note' ? 'bg-attention/[0.05]' : 'bg-card')}>
        <div role="tablist" aria-label={t('tlComposer')} className="mb-2 flex gap-1">
          {(['reply', 'note'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
                mode === m ? (m === 'note' ? 'bg-attention/15 font-medium text-attention' : 'bg-muted font-medium text-foreground') : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'note' ? <StickyNote className="size-3.5" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
              {m === 'note' ? t('tlInternalNote') : t('tlReply')}
            </button>
          ))}
          <span className="docket ms-auto self-center truncate text-muted-foreground max-md:hidden">{mode === 'note' ? t('tlNoteHint') : t('tlReplyHint')}</span>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={mode === 'note' ? t('tlNotePlaceholder') : t('inboxReplyPlaceholder')}
            aria-label={mode === 'note' ? t('tlInternalNote') : t('tlReply')}
            className={cn('max-h-36 min-h-11 flex-1 resize-none text-[13.5px]', mode === 'note' && 'border-attention/40')}
          />
          <Button size="icon-lg" className={cn('size-11', mode === 'note' && 'bg-attention text-background hover:bg-attention/90')} onClick={submit} aria-label={mode === 'note' ? t('tlAddNote') : t('inboxSendReply')} disabled={!text.trim()}>
            {mode === 'note' ? <StickyNote aria-hidden /> : <Send className="rtl:-scale-x-100" aria-hidden />}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MatterContext({ conversation: c }: { conversation: DemoConversation }) {
  const { t } = useLanguage();
  const { go, escalations } = useDemo();
  const dossier = CASES.find((k) => k.reference === c.caseRef);
  const escalation = escalations.find((e) => e.caseRef === c.caseRef && e.status !== 'RESOLVED');

  return (
    <div className="space-y-5 p-4 text-[13px]">
      <section>
        <p className="docket text-muted-foreground">{t('mfClient')}</p>
        <p className="mt-1 text-sm font-semibold">{c.client}</p>
        <Docket items={[c.phone, c.language]} />
      </section>

      {dossier ? (
        <section className="rounded-lg bg-sunken p-3 ring-1 ring-border">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-medium">{dossier.reference}</span>
            <SignalDot level={dossier.urgency === 'CRITICAL' ? 'critical' : dossier.urgency === 'HIGH' ? 'urgent' : 'routine'} />
          </div>
          <p className="mt-1 font-medium leading-snug">{dossier.title}</p>
          <dl className="mt-3 space-y-1.5">
            {[
              [t('tlForum'), dossier.forum],
              [t('mfNextDate'), dossier.nextDate ?? '—'],
              [t('tlLawyer'), dossier.lawyer],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="outline" size="sm" className="mt-3 h-8 w-full" onClick={() => go('cases', { caseRef: dossier.reference })}>
            <FolderOpen aria-hidden />
            {t('tlOpenDossier')}
          </Button>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-border p-3">
          <p className="text-muted-foreground">{t('tlNoMatter')}</p>
          <Button size="sm" className="mt-2 h-8" onClick={() => toast.success(t('tlMatterOpened'))}>
            {t('tlOpenMatter')}
          </Button>
        </section>
      )}

      {escalation ? (
        <section>
          <p className="docket mb-2 text-muted-foreground">{t('navHandoff')}</p>
          <HandoffBriefView reason={escalation.brief.reason} excerpt={null} brief={escalation.brief} />
        </section>
      ) : null}

      <section>
        <p className="docket mb-2 text-muted-foreground">{t('tlQuickActions')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-9 justify-start" onClick={() => toast.success(t('tlDocRequested'), { description: 'FIR copy · via WhatsApp template' })}>
            <FilePlus2 aria-hidden />
            {t('tlRequestDoc')}
          </Button>
          <Button variant="outline" size="sm" className="h-9 justify-start" onClick={() => toast.success(t('tlBooked'), { description: 'Thu 16 Oct · 16:30 · Ayesha Khan' })}>
            <CalendarPlus aria-hidden />
            {t('tlBook')}
          </Button>
        </div>
      </section>
    </div>
  );
}
