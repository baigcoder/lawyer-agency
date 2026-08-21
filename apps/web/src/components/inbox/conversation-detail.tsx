'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronUp,
  Clock,
  Download,
  FileText,
  LockKeyhole,
  MoreVertical,
  Phone,
  Send,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { apiRequest, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { userListSchema } from '@/lib/schemas/users';
import { practiceAreaOptions } from '@/lib/schemas/firm-profile';
import { z } from 'zod';
import { toast } from 'sonner';
import { VoiceNote } from '@/components/inbox/voice-note';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { escalationListSchema } from '@/lib/schemas/escalations';
import {
  formatWaClock,
  formatWaDayLabel,
  isBubbleRunStart,
  shouldShowDayChip,
  waAvatarColor,
  waInitials,
} from '@/components/inbox/wa-format';
import type { InboxDetail, InboxMessage, ConversationState } from '@/lib/schemas/inbox';

const states: ConversationState[] = ['AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED'];
const stateLabel: Record<ConversationState, string> = {
  AI_ACTIVE: 'AI active',
  HUMAN_REQUIRED: 'Needs human',
  HUMAN_ACTIVE: 'Human active',
  CLOSED: 'Closed',
};

interface ConversationDetailProps {
  detail: InboxDetail;
  onBack: () => void;
}

function DeliveryTicks({ status }: { status: string }) {
  if (status === 'QUEUED') {
    return <Clock className="h-3.5 w-3.5" style={{ color: 'var(--wa-tick)' }} aria-hidden />;
  }
  if (status === 'FAILED') {
    return <span className="text-[11px] font-semibold text-destructive">!</span>;
  }
  if (status === 'SENT') {
    return <Check className="h-3.5 w-3.5" style={{ color: 'var(--wa-tick)' }} aria-hidden />;
  }
  return (
    <CheckCheck
      className="h-3.5 w-3.5"
      style={{ color: status === 'READ' ? 'var(--wa-tick-read)' : 'var(--wa-tick)' }}
      aria-hidden
    />
  );
}

function MediaContent({ m, inbound }: { m: InboxMessage; inbound: boolean }) {
  if (m.contentType === 'AUDIO') {
    return (
      <VoiceNote
        messageId={m.id}
        mediaUrl={m.mediaUrl ?? null}
        durationSeconds={m.mediaDurationSeconds ?? null}
        inbound={inbound}
      />
    );
  }
  if (m.contentType === 'IMAGE' && m.mediaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.mediaUrl}
        alt={m.body ?? 'Photo'}
        className="-mx-1 mt-0.5 max-h-64 max-w-full rounded-lg object-cover"
      />
    );
  }
  if (m.contentType === 'DOCUMENT' && m.mediaUrl) {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs"
        style={{ background: 'color-mix(in srgb, currentColor 8%, transparent)' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, currentColor 12%, transparent)' }}
        >
          <FileText className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">Document</p>
          <p className="opacity-60">Tap to view</p>
        </div>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </a>
    );
  }
  return null;
}

function MessageBubble({
  m,
  tail,
}: {
  m: InboxMessage;
  tail: boolean;
}) {
  const isInbound = m.direction === 'INBOUND';
  const isMedia = m.contentType === 'IMAGE' || m.contentType === 'DOCUMENT' || m.contentType === 'AUDIO';
  const hasText = Boolean(m.body?.trim());
  const showName = !isInbound && (m.senderType === 'AI' || m.senderType === 'LAWYER' || m.senderType === 'STAFF');

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'relative max-w-[min(78%,32rem)] px-2 pb-1.5 pt-1 text-[14.2px] leading-[19px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]',
          tail ? (isInbound ? 'rounded-[7.5px] rounded-ss-none' : 'rounded-[7.5px] rounded-se-none') : 'rounded-[7.5px]',
        )}
        style={{
          background: isInbound ? 'var(--wa-in)' : 'var(--wa-out)',
          color: isInbound ? 'var(--wa-in-fg)' : 'var(--wa-out-fg)',
        }}
      >
        {tail ? (
          <span
            aria-hidden
            className={cn(
              'absolute top-0 h-0 w-0 border-t-8 border-transparent',
              isInbound ? 'start-[-8px] border-e-8' : 'end-[-8px] border-s-8',
            )}
            style={
              isInbound
                ? { borderInlineEndColor: 'var(--wa-in)' }
                : { borderInlineStartColor: 'var(--wa-out)' }
            }
          />
        ) : null}
        {showName ? (
          <p className="mb-0.5 text-[12.5px] font-medium" style={{ color: m.senderType === 'AI' ? '#02a698' : '#53bdeb' }}>
            {m.senderName ?? m.senderType}
          </p>
        ) : null}
        <MediaContent m={m} inbound={isInbound} />
        {hasText && m.contentType !== 'AUDIO' ? (
          <p dir="auto" className={cn('whitespace-pre-wrap', isMedia && 'mt-1')}>
            {m.body}
          </p>
        ) : null}
        {hasText && m.contentType === 'AUDIO' ? (
          <p dir="auto" className="mt-1 text-xs opacity-70">
            {m.body}
          </p>
        ) : null}
        {!hasText && !isMedia ? (
          <p className="italic opacity-50">({m.contentType.toLowerCase()})</p>
        ) : null}
        <span
          className="ms-2 inline-flex translate-y-0.5 items-center justify-end gap-0.5 float-end text-[11px] leading-none"
          style={{ color: 'var(--wa-meta)' }}
        >
          {formatWaClock(m.createdAt)}
          {m.direction === 'OUTBOUND' ? <DeliveryTicks status={m.deliveryStatus} /> : null}
        </span>
      </div>
    </div>
  );
}

function SystemChip({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mx-auto w-fit max-w-[92%] rounded-md px-3 py-1.5 text-center text-[12.5px] leading-4 shadow-sm"
      style={{ background: 'var(--wa-system)', color: 'var(--wa-system-fg)' }}
    >
      {children}
    </p>
  );
}

function CallCard({ message }: { message: InboxMessage }) {
  const { t } = useLanguage();
  const minutes = Math.floor((message.call?.durationSeconds ?? 0) / 60);
  const seconds = (message.call?.durationSeconds ?? 0) % 60;
  const duration =
    minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
  const disposition = message.call?.disposition ?? '';
  const outcome =
    disposition === 'BOOKED'
      ? t('inboxCallBooked')
      : disposition === 'ESCALATED'
        ? t('inboxCallEscalated')
        : disposition === 'INFO'
          ? t('inboxCallInfo')
          : t('inboxCallEnded');
  return (
    <div
      className="mx-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3 py-2.5 shadow-sm"
      style={{ background: 'var(--wa-system)', color: 'var(--wa-system-fg)' }}
    >
      <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{t('inboxCallTitle')}</p>
        <p className="text-[12px] opacity-80">
          {outcome} · {duration}
        </p>
        {message.call?.summary ? <p className="mt-1 text-[12.5px] leading-4">{message.call.summary}</p> : null}
      </div>
    </div>
  );
}

export function ConversationDetail({ detail, onBack }: ConversationDetailProps) {
  const { t } = useLanguage();
  const { can } = useSession();
  const canWriteInbox = can('inbox:write');
  const canWriteCases = can('cases:write');
  const router = useRouter();
  const { conversation, messages } = detail;
  const [reply, setReply] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [matterType, setMatterType] = useState(practiceAreaOptions[0] ?? 'Other');
  const [notesOpen, setNotesOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const queryClient = useQueryClient();
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, conversation.id]);

  const assignees = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => apiRequest('/v1/users?status=ACTIVE&limit=100', { schema: userListSchema }),
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeUserId: string | null) =>
      apiRequest(`/v1/inbox/${conversation.id}/assign`, {
        method: 'POST',
        body: { assigneeUserId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const stateMutation = useMutation({
    mutationFn: (state: ConversationState) =>
      apiRequest(`/v1/inbox/${conversation.id}/state`, {
        method: 'POST',
        body: { state },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/reply`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const notesQuery = useQuery({
    queryKey: ['inbox', conversation.id, 'notes'],
    queryFn: () =>
      apiRequest(`/v1/inbox/${conversation.id}/notes`, {
        schema: z.array(
          z.object({
            id: z.string().uuid(),
            body: z.string(),
            author: z.object({ id: z.string().uuid(), name: z.string() }),
            createdAt: z.coerce.date(),
          }),
        ),
      }),
  });

  const handoffQuery = useQuery({
    queryKey: ['escalations', 'conversation', conversation.id],
    enabled: conversation.state === 'HUMAN_REQUIRED',
    queryFn: () => {
      const params = new URLSearchParams({
        conversationId: conversation.id,
        status: 'OPEN',
        limit: '1',
      });
      return apiRequest(`/v1/escalations?${params.toString()}`, { schema: escalationListSchema });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/notes`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setNoteBody('');
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id, 'notes'] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/inbox/${conversation.id}/convert-to-case`, {
        method: 'POST',
        body: { matterType },
        schema: z.object({ caseId: z.string().uuid(), reference: z.string() }),
      }),
    onSuccess: (data) => {
      toast.success(`Case ${data.reference} created`);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      router.push(`/dashboard/cases`);
    },
    onError: () => toast.error('Could not create case'),
  });

  const approveDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      apiRequest(`/v1/payments/${paymentId}/received`, {
        method: 'POST',
        schema: z.object({
          paymentId: z.string().uuid(),
          status: z.string(),
          appointmentId: z.string().uuid().optional(),
        }),
      }),
    onSuccess: (data) => {
      const appointmentId = data.appointmentId ?? conversation.pendingPayment?.appointmentId ?? null;
      if (appointmentId) {
        toast.success(t('inboxPaymentVerifiedWithCalendar'), {
          action: {
            label: t('calendar'),
            onClick: () => router.push(`/dashboard/calendar?appointmentId=${appointmentId}`),
          },
        });
      } else {
        toast.success(t('inboxPaymentVerified'));
      }
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('inboxPaymentVerifyFailed'));
    },
  });

  const windowOpen =
    conversation.sessionWindowExpiresAt &&
    new Date(conversation.sessionWindowExpiresAt) > new Date();

  const notesCount = notesQuery.data?.length ?? 0;
  const displayName = conversation.client.name ?? conversation.client.waPhone;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--wa-chat-bg)' }}>
      <header
        className="flex shrink-0 items-center gap-2 px-2 py-1.5 md:px-4"
        style={{ background: 'var(--wa-header)', borderBottom: '1px solid var(--wa-border)' }}
      >
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--wa-name)' }} />
        </Button>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: waAvatarColor(conversation.client.waPhone) }}
        >
          {waInitials(conversation.client.name, conversation.client.waPhone)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium leading-5" style={{ color: 'var(--wa-name)' }}>
            {displayName}
          </p>
          <p className="truncate text-[13px] leading-4" style={{ color: 'var(--wa-meta)' }}>
            {conversation.client.waPhone}
            {conversation.case ? ` · ${conversation.case.reference}` : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          onClick={() => setNotesOpen((v) => !v)}
          aria-label="Toggle internal notes"
          disabled={!canWriteInbox && notesCount === 0}
        >
          <StickyNote className="h-5 w-5" style={{ color: 'var(--wa-meta)' }} />
          {notesCount > 0 ? (
            <span
              className="absolute top-1 end-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
              style={{ background: 'var(--wa-unread)' }}
            >
              {notesCount}
            </span>
          ) : null}
        </Button>
        {!conversation.case && canWriteCases ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setConvertOpen((v) => !v)}
            aria-label="Convert to case"
          >
            <Briefcase className="h-5 w-5" style={{ color: 'var(--wa-meta)' }} />
          </Button>
        ) : null}
        {canWriteInbox ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setToolsOpen((v) => !v)}
          aria-label={t('inboxStaffTools')}
          aria-expanded={toolsOpen}
        >
          <MoreVertical className="h-5 w-5" style={{ color: 'var(--wa-meta)' }} />
        </Button>
        ) : null}
      </header>

      {toolsOpen && canWriteInbox ? (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ background: 'var(--wa-header)', borderBottom: '1px solid var(--wa-border)' }}
        >
          <Select
            value={conversation.assignedTo?.id ?? '__none__'}
            onValueChange={(v) => assignMutation.mutate(v === '__none__' ? null : v)}
            disabled={assignMutation.isPending}
          >
            <SelectTrigger
              className="h-8 w-auto min-w-[9.5rem] max-w-[16rem] text-xs whitespace-nowrap *:data-[slot=select-value]:line-clamp-none"
              style={{ color: 'var(--wa-name)', borderColor: 'var(--wa-border)' }}
              aria-label={t('inboxAssignTo')}
            >
              <span className="truncate">{conversation.assignedTo?.name ?? t('inboxUnassigned')}</span>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="min-w-48">
              <SelectItem value="__none__">{t('inboxUnassigned')}</SelectItem>
              {(assignees.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.roleName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={conversation.state}
            onValueChange={(v) => stateMutation.mutate(v as ConversationState)}
          >
            <SelectTrigger
              className="h-8 w-auto min-w-[9.5rem] text-xs whitespace-nowrap *:data-[slot=select-value]:line-clamp-none"
              style={{ color: 'var(--wa-name)', borderColor: 'var(--wa-border)' }}
              aria-label={t('inboxStaffTools')}
            >
              <span>{stateLabel[conversation.state]}</span>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="min-w-48">
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {stateLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!windowOpen ? (
            <span className="text-xs text-destructive">{t('inboxWindowClosed')}</span>
          ) : null}
        </div>
      ) : null}

      {conversation.state === 'HUMAN_REQUIRED' && handoffQuery.data?.[0] ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">Lawyer brief</p>
          <HandoffBriefView
            reason={handoffQuery.data[0].handoffReason}
            excerpt={handoffQuery.data[0].detectedExcerpt}
            brief={handoffQuery.data[0].handoffBrief}
          />
        </div>
      ) : null}

      {conversation.pendingDraft ? (
        <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Bot className="h-4 w-4 text-amber-500" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">AI draft — approval required</p>
              <p dir="auto" className="mt-1 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {conversation.pendingDraft.body}
              </p>
              <div className="mt-2 flex gap-2">
                {canWriteInbox ? (
                  <>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={approveDraftMutation.isPending}
                  onClick={() => approveDraftMutation.mutate(conversation.pendingDraft!.messageId)}
                >
                  Approve &amp; send
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={rejectDraftMutation.isPending}
                  onClick={() => rejectDraftMutation.mutate(conversation.pendingDraft!.messageId)}
                >
                  Reject
                </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('inboxViewOnlyHint')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {conversation.pendingPayment?.proofMessageId ? (
        <div className="border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {t('inboxPaymentProofTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {conversation.client.name ?? conversation.client.waPhone}
                {' · '}
                {conversation.pendingPayment.currency}{' '}
                {(conversation.pendingPayment.amountCents / 100).toLocaleString('en-PK')}
                {conversation.pendingPayment.description
                  ? ` · ${conversation.pendingPayment.description}`
                  : ''}
              </p>
              {(() => {
                const proof = messages.find((m) => m.id === conversation.pendingPayment?.proofMessageId);
                if (!proof?.mediaUrl) return null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proof.mediaUrl}
                    alt={t('inboxPaymentProofTitle')}
                    className="mt-2 max-h-32 rounded-lg border object-contain"
                  />
                );
              })()}
              {can('payments:write') ? (
                <Button
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  disabled={verifyPaymentMutation.isPending}
                  onClick={() => verifyPaymentMutation.mutate(conversation.pendingPayment!.id)}
                >
                  {t('inboxPaymentVerify')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {convertOpen && !conversation.case ? (
        <div className="px-4 py-3" style={{ background: 'var(--wa-header)', borderBottom: '1px solid var(--wa-border)' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--wa-meta)' }}>
            Convert to case
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={matterType} onValueChange={(v) => v && setMatterType(v)}>
              <SelectTrigger className="h-8 w-48 text-xs *:data-[slot=select-value]:line-clamp-none">
                <span>{matterType}</span>
              </SelectTrigger>
              <SelectContent>
                {practiceAreaOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              <Briefcase className="mr-1 h-3 w-3" aria-hidden />
              Create case
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {notesOpen ? (
        <div className="px-4 py-3" style={{ background: 'var(--wa-header)', borderBottom: '1px solid var(--wa-border)' }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--wa-meta)' }}>
              <StickyNote className="h-3 w-3" /> Internal notes
            </p>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close notes"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-2 max-h-28 space-y-2 overflow-y-auto text-sm">
            {(notesQuery.data ?? []).map((n) => (
              <div key={n.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--wa-list-bg)' }}>
                <span className="text-xs font-medium">{n.author.name}</span>
                <span className="text-xs" style={{ color: 'var(--wa-meta)' }}> · {n.createdAt.toLocaleString()}</span>
                <p className="mt-0.5 text-sm">{n.body}</p>
              </div>
            ))}
            {notesCount === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--wa-meta)' }}>No notes yet.</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={2}
              placeholder="Add a staff-only note…"
              className="min-h-0 flex-1 resize-none text-sm"
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!noteBody.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate(noteBody.trim())}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <div className="wa-thread min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4 py-3 md:px-10">
        <SystemChip>
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--wa-encrypt-fg)' }}>
            <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden />
            {t('inboxEncrypted')}
          </span>
        </SystemChip>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--wa-meta)' }}>
            {t('inboxNoMessages')}
          </p>
        ) : (
          messages.map((m, index) => {
            if (m.contentType === 'CALL' || m.call) {
              return (
                <div key={m.id} className="py-1.5">
                  {shouldShowDayChip(messages, index) ? (
                    <p
                      className="mx-auto mb-1.5 w-fit rounded-md px-2.5 py-1 text-[12.5px] font-medium uppercase shadow-sm"
                      style={{ background: 'var(--wa-system)', color: 'var(--wa-system-fg)' }}
                    >
                      {formatWaDayLabel(m.createdAt, t('today'), t('inboxYesterday'))}
                    </p>
                  ) : null}
                  <CallCard message={m} />
                </div>
              );
            }
            if (m.senderType === 'SYSTEM') {
              return (
                <div key={m.id} className="py-1.5">
                  {shouldShowDayChip(messages, index) ? (
                    <p
                      className="mx-auto mb-1.5 w-fit rounded-md px-2.5 py-1 text-[12.5px] font-medium uppercase shadow-sm"
                      style={{ background: 'var(--wa-system)', color: 'var(--wa-system-fg)' }}
                    >
                      {formatWaDayLabel(m.createdAt, t('today'), t('inboxYesterday'))}
                    </p>
                  ) : null}
                  <SystemChip>{m.body ?? m.contentType}</SystemChip>
                </div>
              );
            }
            return (
              <div key={m.id} className={cn(isBubbleRunStart(messages, index) ? 'pt-2' : 'pt-0.5')}>
                {shouldShowDayChip(messages, index) ? (
                  <p
                    className="mx-auto mb-2 w-fit rounded-md px-2.5 py-1 text-[12.5px] font-medium uppercase shadow-sm"
                    style={{ background: 'var(--wa-system)', color: 'var(--wa-system-fg)' }}
                  >
                    {formatWaDayLabel(m.createdAt, t('today'), t('inboxYesterday'))}
                  </p>
                ) : null}
                <MessageBubble m={m} tail={isBubbleRunStart(messages, index)} />
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 px-2 py-1.5 md:px-4" style={{ background: 'var(--wa-composer-bar)' }}>
        {!canWriteInbox ? (
          <p className="mb-1.5 rounded-lg px-3 py-1.5 text-xs" style={{ color: 'var(--wa-meta)' }}>
            {t('inboxViewOnlyHint')}
          </p>
        ) : !windowOpen ? (
          <p className="mb-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {t('inboxReplyClosed')}
          </p>
        ) : null}
        {canWriteInbox ? (
        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={windowOpen ? t('inboxReplyPlaceholder') : t('inboxReplyClosed')}
            disabled={!windowOpen || replyMutation.isPending}
            rows={1}
            className="min-h-10 max-h-32 flex-1 resize-none rounded-[24px] border-0 px-4 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
            style={{ background: 'var(--wa-composer)', color: 'var(--wa-name)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (reply.trim() && windowOpen) replyMutation.mutate(reply.trim());
              }
            }}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full border-0 text-white hover:opacity-90"
            style={{ background: 'var(--wa-filter)' }}
            disabled={!reply.trim() || !windowOpen || replyMutation.isPending}
            onClick={() => replyMutation.mutate(reply.trim())}
            aria-label={t('inboxSendReply')}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        ) : null}
        {replyMutation.isError ? (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {replyMutation.error instanceof ApiError
              ? replyMutation.error.message
              : 'Failed to send reply'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
