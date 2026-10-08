'use client';

import type { ReactNode } from 'react';
import { Bot, FileText, ImageIcon, Mic, Phone, Search, UserCheck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';
import type { InboxSummary, ConversationState } from '@/lib/schemas/inbox';
import { formatWaListTime, waInitials } from '@/components/inbox/wa-format';
import { Docket, signalRule, type SignalLevel } from '@/components/signal';
import { PersonAvatar } from '@/components/workspace/panel';

interface ConversationListProps {
  conversations: InboxSummary[];
  selectedId: string | null;
  activeTab: ConversationState | 'ALL' | 'UNASSIGNED' | 'ME';
  tabs: Array<{ label: string; value: ConversationState | 'ALL' | 'UNASSIGNED' | 'ME' }>;
  search: string;
  onSelect: (id: string) => void;
  onTabChange: (value: ConversationState | 'ALL' | 'UNASSIGNED' | 'ME') => void;
  onSearch: (value: string) => void;
  leading?: ReactNode;
}

function PreviewLine({ conversation }: { conversation: InboxSummary }) {
  const { t } = useLanguage();
  const last = conversation.lastMessage;
  if (!last) {
    return <span className="truncate italic text-muted-foreground/70">{t('inboxNoMessages')}</span>;
  }

  const senderPrefix =
    last.senderType === 'AI' ? (
      <span className="inline-flex items-center gap-0.5 text-primary/80 font-medium me-1">
        <Bot className="inline size-3 shrink-0" aria-hidden /> AI ·
      </span>
    ) : last.senderType === 'LAWYER' || last.senderType === 'STAFF' ? (
      <span className="inline-flex items-center gap-0.5 text-foreground/80 font-medium me-1">
        <UserCheck className="inline size-3 shrink-0" aria-hidden /> {t('tlFirm')} ·
      </span>
    ) : null;

  if (last.contentType === 'AUDIO') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {senderPrefix}
        <Mic className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{t('inboxVoiceNote')}</span>
      </span>
    );
  }
  if (last.contentType === 'IMAGE') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {senderPrefix}
        <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{t('inboxPhoto')}</span>
      </span>
    );
  }
  if (last.contentType === 'CALL') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {senderPrefix}
        <Phone className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{last.body?.trim() || t('inboxCallTitle')}</span>
      </span>
    );
  }
  if (last.contentType === 'DOCUMENT') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {senderPrefix}
        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{t('inboxDocument')}</span>
      </span>
    );
  }
  return (
    <span className="truncate">
      {senderPrefix}
      {last.body?.trim() || t('inboxNoMessages')}
    </span>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  activeTab,
  tabs,
  search,
  onSelect,
  onTabChange,
  onSearch,
  leading,
}: ConversationListProps) {
  const { t } = useLanguage();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sunken/60">
      <div className="space-y-3 border-b border-border p-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            {leading}
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{t('inbox')}</h1>
          </div>
          <span className="docket text-muted-foreground">{conversations.length} · WhatsApp</span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder={t('inboxSearchPlaceholder')}
            aria-label={t('inboxSearchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-8 bg-background pe-7 ps-8 text-[13px]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('close')}
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">/</kbd>
          )}
        </div>

        <div role="tablist" aria-label={t('inbox')} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
                  active ? 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {conversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('inboxNoConversations')}</p>
        ) : (
          <ul aria-label={t('inboxChats')} className="space-y-px">
            {conversations.map((c) => {
              const selected = selectedId === c.id;
              const unread = c.unreadCount > 0;
              const when = c.lastMessage?.createdAt ?? c.lastClientMessageAt ?? c.updatedAt;
              const level = rowSignal(c);

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'relative grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg px-3 py-2.5 text-start transition-colors',
                      level && `before:absolute before:inset-y-3 before:start-0 before:w-[2.5px] before:rounded-full ${signalRule(level)}`,
                      selected ? 'bg-background shadow-xs ring-1 ring-border' : 'hover:bg-background/70',
                    )}
                  >
                    <PersonAvatar initials={waInitials(c.client.name, c.client.waPhone)} />
                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[13.5px]', unread ? 'font-semibold' : 'font-medium')}>
                          {c.client.name ?? c.client.waPhone}
                        </span>
                        <span className={cn('shrink-0 font-mono text-[11px] tabular-nums', unread ? 'text-primary' : 'text-muted-foreground')}>
                          {when ? formatWaListTime(when, t('inboxYesterday')) : ''}
                        </span>
                      </span>
                      <span className={cn('mt-0.5 block truncate text-[12.5px]', unread ? 'text-foreground/85' : 'text-muted-foreground')}>
                        <PreviewLine conversation={c} />
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <Docket items={[c.case?.reference, c.assignedTo?.name.split(' ')[0]]} className="min-w-0 flex-1 truncate" />
                        {c.pendingDraft ? <span className="docket rounded bg-attention/12 px-1.5 text-attention">{t('tlDraft')}</span> : null}
                        {c.pendingPayment?.proofMessageId ? (
                          <span className="docket rounded bg-primary/10 px-1.5 text-primary" title={t('inboxPaymentProofBadge')}>
                            {t('tlProof')}
                          </span>
                        ) : null}
                        {unread ? (
                          <span className="min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-[11px] leading-5 text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function rowSignal(c: InboxSummary): SignalLevel | null {
  if (c.state === 'HUMAN_REQUIRED') return c.pendingDraft ? 'attention' : 'urgent';
  if (c.pendingDraft || c.pendingPayment?.proofMessageId) return 'attention';
  return null;
}
