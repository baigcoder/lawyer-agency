'use client';

import type { ReactNode } from 'react';
import { Bot, Coins, FileText, ImageIcon, Mic, Phone, Search, UserCheck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';
import type { InboxSummary, ConversationState } from '@/lib/schemas/inbox';
import { formatWaListTime, waAvatarColor, waInitials } from '@/components/inbox/wa-format';

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
        <Bot className="h-3 w-3 inline shrink-0" aria-hidden /> AI:
      </span>
    ) : last.senderType === 'LAWYER' || last.senderType === 'STAFF' ? (
      <span className="inline-flex items-center gap-0.5 text-foreground/80 font-medium me-1">
        <UserCheck className="h-3 w-3 inline shrink-0" aria-hidden /> Firm:
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
    <div className="flex h-full min-h-0 flex-col bg-card/40 backdrop-blur-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          {leading}
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {t('inboxChats')}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-3 pb-2.5">
        <div className="relative">
          <Search
            className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder={t('inboxSearchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-8 rounded-md bg-muted/60 pe-7 ps-8 text-xs border border-border/70 focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded border border-border/60 bg-background/80 px-1 text-[10px] text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 border-b border-border/50 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              aria-pressed={active}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conversation List Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-border/40">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <p className="text-xs">{t('inboxNoConversations')}</p>
          </div>
        ) : (
          <ul aria-label={t('inboxChats')} className="space-y-0.5 p-1">
            {conversations.map((c) => {
              const selected = selectedId === c.id;
              const unread = c.unreadCount > 0;
              const when = c.lastMessage?.createdAt ?? c.lastClientMessageAt ?? c.updatedAt;
              const needsHuman = c.state === 'HUMAN_REQUIRED';

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'group relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-all',
                      selected
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                        : 'text-foreground/90 hover:bg-muted/60',
                    )}
                  >
                    {/* Status Pill Strip for active selection */}
                    {selected && (
                      <span className="absolute start-0 top-1.5 bottom-1.5 w-1 rounded-r-sm bg-primary" />
                    )}

                    {/* Avatar */}
                    <span
                      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-2xs mt-0.5"
                      style={{ background: waAvatarColor(c.client.waPhone) }}
                      aria-hidden
                    >
                      {waInitials(c.client.name, c.client.waPhone)}
                      {needsHuman && (
                        <span
                          className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse"
                          title="Requires lawyer attention"
                        />
                      )}
                    </span>

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {/* Line 1: Name + Time */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'truncate text-xs tracking-tight',
                            unread ? 'font-bold text-foreground' : 'font-medium text-foreground/90',
                          )}
                        >
                          {c.client.name ?? c.client.waPhone}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[10px] tabular-nums',
                            unread ? 'font-semibold text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {when ? formatWaListTime(when, t('inboxYesterday')) : ''}
                        </span>
                      </div>

                      {/* Line 2: Message Preview */}
                      <div
                        className={cn(
                          'line-clamp-1 text-[11px] leading-tight',
                          unread ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <PreviewLine conversation={c} />
                      </div>

                      {/* Line 3: Metadata Badges (Matter, Payment Proof, Unread Count) */}
                      <div className="flex items-center gap-1.5 pt-1">
                        {c.case?.reference && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono font-medium text-muted-foreground">
                            {c.case.reference}
                          </span>
                        )}
                        {c.assignedTo?.name && (
                          <span className="truncate text-[9px] text-muted-foreground max-w-[90px]">
                            {c.assignedTo.name}
                          </span>
                        )}
                        {c.pendingPayment?.proofMessageId && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-medium text-emerald-600 dark:text-emerald-400"
                            title={t('inboxPaymentProofBadge')}
                          >
                            <Coins className="h-2.5 w-2.5 shrink-0" />
                            Proof
                          </span>
                        )}
                        {c.pendingDraft && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-medium text-amber-600 dark:text-amber-400"
                            title="AI draft waiting"
                          >
                            <Bot className="h-2.5 w-2.5 shrink-0" />
                            Draft
                          </span>
                        )}
                        <span className="flex-1" />
                        {unread && (
                          <Badge
                            variant="default"
                            className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold leading-none bg-primary text-primary-foreground flex items-center justify-center"
                          >
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
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
