'use client';

import type { ReactNode } from 'react';
import { Coins, FileText, ImageIcon, Mic, Phone, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    return <span className="truncate">{t('inboxNoMessages')}</span>;
  }
  if (last.contentType === 'AUDIO') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{t('inboxVoiceNote')}</span>
      </span>
    );
  }
  if (last.contentType === 'IMAGE') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{t('inboxPhoto')}</span>
      </span>
    );
  }
  if (last.contentType === 'CALL') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{last.body?.trim() || t('inboxCallTitle')}</span>
      </span>
    );
  }
  if (last.contentType === 'DOCUMENT') {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{t('inboxDocument')}</span>
      </span>
    );
  }
  return <span className="truncate">{last.body?.trim() || t('inboxNoMessages')}</span>;
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
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--wa-list-bg)' }}>
      <div className="flex items-center gap-1 px-3 pb-1.5 pt-3">
        {leading}
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--wa-name)' }}>
          {t('inboxChats')}
        </h1>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--wa-meta)' }}
            aria-hidden
          />
          <Input
            placeholder={t('inboxSearchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-9 rounded-lg border-0 ps-9 text-sm shadow-none focus-visible:ring-0"
            style={{ background: 'var(--wa-search)', color: 'var(--wa-name)' }}
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              aria-pressed={active}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                active ? 'text-white' : 'hover:opacity-80',
              )}
              style={
                active
                  ? { background: 'var(--wa-filter)' }
                  : {
                      background: 'transparent',
                      color: 'var(--wa-meta)',
                      boxShadow: 'inset 0 0 0 1px var(--wa-border)',
                    }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--wa-meta)' }}>
            {t('inboxNoConversations')}
          </p>
        ) : (
          <ul role="listbox" aria-label={t('inboxChats')}>
            {conversations.map((c) => {
              const selected = selectedId === c.id;
              const unread = c.unreadCount > 0;
              const when = c.lastMessage?.createdAt ?? c.lastClientMessageAt ?? c.updatedAt;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => onSelect(c.id)}
                    aria-selected={selected}
                    className="flex w-full items-center gap-3 px-3 py-2 text-start"
                    style={{ background: selected ? 'var(--wa-list-active)' : 'transparent' }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = 'var(--wa-list-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = selected ? 'var(--wa-list-active)' : 'transparent';
                    }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                      style={{ background: waAvatarColor(c.client.waPhone) }}
                      aria-hidden
                    >
                      {waInitials(c.client.name, c.client.waPhone)}
                    </span>
                    <span
                      className="flex min-w-0 flex-1 flex-col gap-px border-b pb-2"
                      style={{ borderColor: 'var(--wa-border)' }}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[16px] leading-5" style={{ color: 'var(--wa-name)', fontWeight: unread ? 600 : 400 }}>
                          {c.client.name ?? c.client.waPhone}
                        </span>
                        <span
                          className="shrink-0 text-[11px] leading-4"
                          style={{ color: unread ? 'var(--wa-unread)' : 'var(--wa-meta)' }}
                        >
                          {when ? formatWaListTime(when, t('inboxYesterday')) : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="min-w-0 flex-1 text-[13px] leading-5"
                          style={{ color: unread ? 'var(--wa-name)' : 'var(--wa-meta)' }}
                        >
                          <PreviewLine conversation={c} />
                        </span>
                        {c.state === 'HUMAN_REQUIRED' ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-destructive"
                            title={t('inboxTabNeedsHuman')}
                            aria-label={t('inboxTabNeedsHuman')}
                          />
                        ) : null}
                        {c.pendingPayment?.proofMessageId ? (
                          <span title={t('inboxPaymentProofBadge')} aria-label={t('inboxPaymentProofBadge')}>
                            <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--wa-unread)' }} />
                          </span>
                        ) : null}
                        {unread ? (
                          <span
                            className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                            style={{ background: 'var(--wa-unread)' }}
                          >
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
