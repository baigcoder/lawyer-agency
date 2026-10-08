'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileText,
  FolderOpen,
  PanelRightOpen,
  Phone,
  Send,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApprovalGate } from '@/components/approval-gate';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { TimelineMessage } from '@/components/inbox/timeline-message';
import { VoiceNote } from '@/components/inbox/voice-note';
import { formatWaClock, formatWaDayLabel, waInitials } from '@/components/inbox/wa-format';
import { Docket, Signal, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PersonAvatar } from '@/components/workspace/panel';
import { SlaClock } from '@/components/workspace/sla-clock';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { escalationListSchema, type EscalationSummary } from '@/lib/schemas/escalations';
import { practiceAreaOptions } from '@/lib/schemas/firm-profile';
import type { ConversationState, InboxDetail, InboxMessage } from '@/lib/schemas/inbox';
import { userListSchema } from '@/lib/schemas/users';
import { useSession } from '@/lib/session';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const states: ConversationState[] = ['AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED'];
const stateKey: Record<ConversationState, TranslationKey> = {
  AI_ACTIVE: 'inboxTabAiActive',
  HUMAN_REQUIRED: 'inboxTabNeedsHuman',
  HUMAN_ACTIVE: 'inboxTabHumanActive',
  CLOSED: 'inboxTabClosed',
};
const stateSignal: Record<ConversationState, SignalLevel> = {
  AI_ACTIVE: 'ok',
  HUMAN_REQUIRED: 'attention',
  HUMAN_ACTIVE: 'routine',
  CLOSED: 'info',
};

interface ConversationDetailProps {
  detail: InboxDetail;
  onBack: () => void;
}

function DeliveryStatusIcon({ status }: { status: string }) {
  if (status === 'QUEUED') {
    return <Clock className="size-3 text-muted-foreground/70" aria-label="Queued" />;
  }
  if (status === 'FAILED') {
    return <span className="text-xs font-bold text-critical" aria-label="Failed">!</span>;
  }
  if (status === 'SENT') {
    return <Check className="size-3 text-muted-foreground" aria-label="Sent" />;
  }
  return (
    <CheckCheck
      className={cn('size-3', status === 'READ' ? 'text-primary' : 'text-muted-foreground')}
      aria-label={status === 'READ' ? 'Read' : 'Delivered'}
    />
  );
}

function MediaAttachment({ m, inbound }: { m: InboxMessage; inbound: boolean }) {
  const { t } = useLanguage();
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
        alt={m.body ?? 'Shared image'}
        className="max-h-72 max-w-full rounded-md object-cover ring-1 ring-border"
      />
    );
  }
  if (m.contentType === 'DOCUMENT' && m.mediaUrl) {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border transition-colors hover:bg-muted"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{t('inboxDocument')}</span>
        <Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    );
  }
  return null;
}

function CallTimelineCard({ message }: { message: InboxMessage }) {
  const { t } = useLanguage();
  const minutes = Math.floor((message.call?.durationSeconds ?? 0) / 60);
  const seconds = (message.call?.durationSeconds ?? 0) % 60;
  const duration = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
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
    <div className="mx-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Phone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">{t('inboxCallTitle')}</p>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{duration}</span>
        </div>
        <p className="text-xs text-muted-foreground">{outcome}</p>
        {message.call?.summary ? (
          <p dir="auto" className="mt-1.5 rounded-md bg-muted p-2 text-[13px]">
            “{message.call.summary}”
          </p>
        ) : null}
      </div>
    </div>
  );
}

type Note = { id: string; body: string; author: { id: string; name: string }; createdAt: Date };
type Entry = { kind: 'message'; at: Date; m: InboxMessage } | { kind: 'note'; at: Date; note: Note };

function dayOf(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function ConversationDetail({ detail, onBack }: ConversationDetailProps) {
  const { t } = useLanguage();
  const { can } = useSession();
  const canWriteInbox = can('inbox:write');
  const canWriteCases = can('cases:write');
  const router = useRouter();
  const { conversation, messages } = detail;

  const [reply, setReply] = useState('');
  const [composerMode, setComposerMode] = useState<'REPLY' | 'NOTE'>('REPLY');
  const [contextOpen, setContextOpen] = useState(true);
  const [contextSheet, setContextSheet] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [matterType, setMatterType] = useState<string>(practiceAreaOptions[0] ?? 'Other');
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftEditBody, setDraftEditBody] = useState(conversation.pendingDraft?.body ?? '');

  const queryClient = useQueryClient();
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const [prevDraftBody, setPrevDraftBody] = useState(conversation.pendingDraft?.body);
  if (conversation.pendingDraft?.body !== prevDraftBody) {
    setPrevDraftBody(conversation.pendingDraft?.body);
    setDraftEditBody(conversation.pendingDraft?.body ?? '');
  }

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
      toast.success(t('tlAssigned'));
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
      toast.success(t('tlStateUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
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
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
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

  const addNoteMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/notes`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setNoteBody('');
      toast.success(t('tlNoteAdded'));
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id, 'notes'] });
    },
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

  const convertMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/inbox/${conversation.id}/convert-to-case`, {
        method: 'POST',
        body: { matterType },
        schema: z.object({ caseId: z.string().uuid(), reference: z.string() }),
      }),
    onSuccess: (data) => {
      toast.success(`${t('tlMatterOpened')} · ${data.reference}`);
      setConvertModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      router.push(`/dashboard/cases`);
    },
    onError: () => toast.error(t('tlCaseFailed')),
  });

  const approveDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('demoToastSent'));
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
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

  const windowOpen = Boolean(
    conversation.sessionWindowExpiresAt && new Date(conversation.sessionWindowExpiresAt) > new Date(),
  );
  const displayName = conversation.client.name ?? conversation.client.waPhone;
  const openEscalation = handoffQuery.data?.[0];
  const draft = conversation.pendingDraft ?? null;
  const draftEdited = Boolean(draft && draftEditBody.trim() && draftEditBody.trim() !== draft.body.trim());
  const draftBusy = approveDraftMutation.isPending || rejectDraftMutation.isPending || replyMutation.isPending;

  // The approve endpoint sends the draft exactly as the AI wrote it. If the
  // lawyer edited it, the AI draft is withdrawn and their text goes out as a
  // normal lawyer reply — otherwise their edits would be silently dropped.
  const approveDraft = async () => {
    if (!draft) return;
    if (!draftEdited) {
      approveDraftMutation.mutate(draft.messageId);
      return;
    }
    try {
      await rejectDraftMutation.mutateAsync(draft.messageId);
      await replyMutation.mutateAsync(draftEditBody.trim());
      setEditingDraft(false);
      toast.success(t('demoToastSent'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('tlSendFailed'));
    }
  };

  // Internal notes join the timeline so the thread reads as one record.
  const entries: Entry[] = [
    ...messages.filter((m) => !m.pendingApproval).map((m): Entry => ({ kind: 'message', at: m.createdAt, m })),
    ...(notesQuery.data ?? []).map((note): Entry => ({ kind: 'note', at: note.createdAt, note })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const toggleContext = () => {
    if (window.matchMedia('(min-width: 1536px)').matches) setContextOpen((v) => !v);
    else setContextSheet(true);
  };

  const context = (
    <MatterContextPanel
      conversation={conversation}
      displayName={displayName}
      escalation={openEscalation}
      canWriteCases={canWriteCases}
      convertModalOpen={convertModalOpen}
      setConvertModalOpen={setConvertModalOpen}
      matterType={matterType}
      setMatterType={setMatterType}
      convertPending={convertMutation.isPending}
      onConvert={() => convertMutation.mutate()}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
      <section aria-label={displayName} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label={t('tlBack')}>
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
          </Button>
          <PersonAvatar initials={waInitials(conversation.client.name, conversation.client.waPhone)} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
              {displayName}
              {conversation.case?.reference ? (
                <Link href="/dashboard/cases" className="docket rounded bg-muted px-1.5 text-foreground/80 hover:bg-accent hover:text-accent-foreground">
                  {conversation.case.reference}
                </Link>
              ) : null}
            </h2>
            <Docket items={[conversation.client.waPhone, conversation.assignedTo?.name]} />
          </div>

          {canWriteInbox ? (
            <Select
              value={conversation.state}
              onValueChange={(v) => stateMutation.mutate(v as ConversationState)}
              disabled={stateMutation.isPending}
            >
              <SelectTrigger className="hidden h-8 w-[9.5rem] text-xs sm:flex" aria-label={t('demoStatus')}>
                <SelectValue>{t(stateKey[conversation.state])}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {states.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {t(stateKey[s])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Signal level={stateSignal[conversation.state]} className="hidden sm:inline-flex">
              {t(stateKey[conversation.state])}
            </Signal>
          )}

          {canWriteInbox ? (
            <Select
              value={conversation.assignedTo?.id ?? '__none__'}
              onValueChange={(v) => assignMutation.mutate(v === '__none__' ? null : v)}
              disabled={assignMutation.isPending}
            >
              <SelectTrigger className="hidden h-8 w-[9.5rem] text-xs lg:flex" aria-label={t('tlLawyer')}>
                <span className="truncate">{conversation.assignedTo?.name ?? t('demoUnassigned')}</span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__none__" className="text-xs">
                  {t('demoUnassigned')}
                </SelectItem>
                {(assignees.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name} · {u.roleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button variant="outline" size="icon-sm" onClick={toggleContext} aria-label={t('tlMatterContext')}>
            <PanelRightOpen className="rtl:-scale-x-100" aria-hidden />
          </Button>
        </header>

        <div className={cn('flex items-center justify-between gap-3 border-b border-border px-4 py-1.5', windowOpen ? 'bg-sunken/60' : 'bg-attention/[0.07]')}>
          <span className={cn('docket truncate', windowOpen ? 'text-muted-foreground' : 'text-attention')}>
            {windowOpen ? t('tlWindowOpen') : t('inboxReplyClosed')}
          </span>
          {windowOpen && conversation.sessionWindowExpiresAt ? (
            <SlaClock deadline={conversation.sessionWindowExpiresAt} label="" className="text-xs" />
          ) : null}
        </div>

        {conversation.state === 'HUMAN_REQUIRED' && openEscalation ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-critical/25 bg-critical/[0.06] px-4 py-2.5">
            <Signal level={openEscalation.triggerType === 'IMMINENT_DEADLINE' ? 'urgent' : 'critical'}>
              {t(`escTrigger${openEscalation.triggerType}`)}
            </Signal>
            <p className="min-w-0 flex-1 truncate text-[13px]">
              {openEscalation.handoffReason ?? openEscalation.handoffBrief.reason}
            </p>
            <SlaClock deadline={openEscalation.slaDeadline} stopped={Boolean(openEscalation.acknowledgedAt)} />
            <Button nativeButton={false} variant="outline" size="sm" className="h-7" render={<Link href="/dashboard/escalations" />}>
              {t('escalations')}
            </Button>
          </div>
        ) : null}

        {conversation.pendingPayment?.proofMessageId ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/[0.05] px-4 py-2.5">
            <Coins className="size-4 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">
                {t('inboxPaymentProofTitle')} ·{' '}
                <span className="font-mono tabular-nums">
                  {conversation.pendingPayment.currency}{' '}
                  {(conversation.pendingPayment.amountCents / 100).toLocaleString('en-PK')}
                </span>
              </p>
              {conversation.pendingPayment.description ? (
                <p className="truncate text-xs text-muted-foreground">{conversation.pendingPayment.description}</p>
              ) : null}
            </div>
            {can('payments:write') ? (
              <Button
                size="sm"
                className="h-8"
                disabled={verifyPaymentMutation.isPending}
                onClick={() => verifyPaymentMutation.mutate(conversation.pendingPayment!.id)}
              >
                <CheckCircle2 aria-hidden />
                {t('inboxPaymentVerify')}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6">
          {entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('inboxNoMessages')}</p>
          ) : null}
          {entries.map((entry, index) => {
            const prev = entries[index - 1];
            const dayChip =
              !prev || dayOf(prev.at) !== dayOf(entry.at) ? (
                <p className="docket pb-3 text-center text-muted-foreground">
                  {formatWaDayLabel(entry.at, t('today'), t('inboxYesterday'))}
                </p>
              ) : null;

            if (entry.kind === 'note') {
              return (
                <div key={`note-${entry.note.id}`}>
                  {dayChip}
                  <TimelineMessage from="note" author={entry.note.author.name} body={entry.note.body} time={formatWaClock(entry.at)} />
                </div>
              );
            }

            const m = entry.m;
            if (m.contentType === 'CALL' || m.call) {
              return (
                <div key={m.id}>
                  {dayChip}
                  <CallTimelineCard message={m} />
                </div>
              );
            }
            const from =
              m.senderType === 'SYSTEM' ? 'system' : m.direction === 'INBOUND' ? 'client' : m.senderType === 'AI' ? 'ai' : 'lawyer';
            const media = m.contentType === 'AUDIO' || m.contentType === 'IMAGE' || m.contentType === 'DOCUMENT';
            return (
              <div key={m.id}>
                {dayChip}
                <TimelineMessage
                  from={from}
                  author={m.senderName ?? t('tlLawyer')}
                  time={formatWaClock(m.createdAt)}
                  status={m.direction === 'OUTBOUND' && from !== 'system' ? <DeliveryStatusIcon status={m.deliveryStatus} /> : undefined}
                  body={
                    media ? (
                      <>
                        <MediaAttachment m={m} inbound={m.direction === 'INBOUND'} />
                        {m.body ? <span className="mt-1.5 block whitespace-pre-wrap">{m.body}</span> : null}
                      </>
                    ) : (
                      m.body ?? m.contentType
                    )
                  }
                />
              </div>
            );
          })}

          {draft ? (
            <div className="ms-auto max-w-[min(34rem,92%)]">
              <ApprovalGate
                meta={draftEdited ? t('tlEditedReply') : t('mfToClient')}
                onApprove={canWriteInbox ? () => void approveDraft() : undefined}
                onEdit={canWriteInbox ? () => setEditingDraft((v) => !v) : undefined}
                approveDisabled={!canWriteInbox || !draftEditBody.trim() || (draftEdited && !windowOpen)}
                approvePending={draftBusy}
              >
                {editingDraft ? (
                  <Textarea
                    value={draftEditBody}
                    onChange={(e) => setDraftEditBody(e.target.value)}
                    dir="auto"
                    aria-label={t('gateEdit')}
                    autoFocus
                    className="min-h-24 border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <span dir="auto" className="block whitespace-pre-wrap">
                    {draftEditBody}
                  </span>
                )}
              </ApprovalGate>
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-3">
                {draftEdited && !windowOpen ? <span className="text-xs text-attention">{t('tlEditNeedsWindow')}</span> : null}
                {canWriteInbox ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-muted-foreground"
                    disabled={draftBusy}
                    onClick={() =>
                      rejectDraftMutation.mutate(draft.messageId, { onSuccess: () => toast.success(t('tlDraftDiscarded')) })
                    }
                  >
                    <Trash2 aria-hidden />
                    {t('tlDiscardDraft')}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('inboxViewOnlyHint')}</span>
                )}
              </div>
            </div>
          ) : null}
          <div ref={threadEndRef} />
        </div>

        <div className={cn('shrink-0 border-t border-border p-3', composerMode === 'NOTE' ? 'bg-attention/[0.05]' : 'bg-card')}>
          <div role="tablist" aria-label={t('tlComposer')} className="mb-2 flex gap-1">
            {(['REPLY', 'NOTE'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={composerMode === mode}
                onClick={() => setComposerMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
                  composerMode === mode
                    ? mode === 'NOTE'
                      ? 'bg-attention/15 font-medium text-attention'
                      : 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'NOTE' ? <StickyNote className="size-3.5" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                {mode === 'NOTE' ? t('tlInternalNote') : t('tlReply')}
              </button>
            ))}
            <span className="docket ms-auto self-center truncate text-muted-foreground max-md:hidden">
              {composerMode === 'NOTE' ? t('tlNoteHint') : t('tlReplyHint')}
            </span>
          </div>
          {composerMode === 'REPLY' ? (
            <div className="flex items-end gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={windowOpen ? t('inboxReplyPlaceholder') : t('inboxReplyClosed')}
                aria-label={t('tlReply')}
                disabled={!windowOpen || !canWriteInbox || replyMutation.isPending}
                rows={2}
                dir="auto"
                className="max-h-36 min-h-11 flex-1 resize-none text-[13.5px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (reply.trim() && windowOpen) replyMutation.mutate(reply.trim());
                  }
                }}
              />
              <Button
                size="icon-lg"
                className="size-11"
                disabled={!reply.trim() || !windowOpen || !canWriteInbox || replyMutation.isPending}
                onClick={() => replyMutation.mutate(reply.trim())}
                aria-label={t('inboxSendReply')}
              >
                <Send className="rtl:-scale-x-100" aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={t('tlNotePlaceholder')}
                aria-label={t('tlInternalNote')}
                rows={2}
                dir="auto"
                className="max-h-36 min-h-11 flex-1 resize-none border-attention/40 text-[13.5px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (noteBody.trim()) addNoteMutation.mutate(noteBody.trim());
                  }
                }}
              />
              <Button
                size="icon-lg"
                className="size-11 bg-attention text-background hover:bg-attention/90"
                disabled={!noteBody.trim() || addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate(noteBody.trim())}
                aria-label={t('tlAddNote')}
              >
                <StickyNote aria-hidden />
              </Button>
            </div>
          )}
          {replyMutation.isError ? (
            <p role="alert" className="mt-1.5 text-xs text-critical">
              {t('tlSendFailed')}
            </p>
          ) : null}
        </div>
      </section>

      {contextOpen ? (
        <aside aria-label={t('tlMatterContext')} className="hidden w-[340px] shrink-0 overflow-y-auto border-s border-border bg-card 2xl:block">
          {context}
        </aside>
      ) : null}
      {contextSheet ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 2xl:hidden" onClick={() => setContextSheet(false)}>
          <aside
            className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('tlMatterContext')}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="docket text-muted-foreground">{t('tlMatterContext')}</p>
              <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={() => setContextSheet(false)}>
                <X aria-hidden />
              </Button>
            </div>
            {context}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function MatterContextPanel({
  conversation,
  displayName,
  escalation,
  canWriteCases,
  convertModalOpen,
  setConvertModalOpen,
  matterType,
  setMatterType,
  convertPending,
  onConvert,
}: {
  conversation: InboxDetail['conversation'];
  displayName: string;
  escalation: EscalationSummary | undefined;
  canWriteCases: boolean;
  convertModalOpen: boolean;
  setConvertModalOpen: (open: boolean) => void;
  matterType: string;
  setMatterType: (value: string) => void;
  convertPending: boolean;
  onConvert: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-5 p-4 text-[13px]">
      <section>
        <p className="docket text-muted-foreground">{t('mfClient')}</p>
        <p className="mt-1 text-sm font-semibold">{displayName}</p>
        <Docket items={[conversation.client.waPhone, t(stateKey[conversation.state])]} />
      </section>

      {conversation.case ? (
        <section className="rounded-lg bg-sunken p-3 ring-1 ring-border">
          <p className="docket text-muted-foreground">{t('demoDossier')}</p>
          <p className="mt-1 font-mono text-sm font-medium">{conversation.case.reference}</p>
          <Button nativeButton={false} variant="outline" size="sm" className="mt-3 h-8 w-full" render={<Link href="/dashboard/cases" />}>
            <FolderOpen aria-hidden />
            {t('tlOpenDossier')}
          </Button>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-border p-3">
          <p className="text-muted-foreground">{t('tlNoMatter')}</p>
          {canWriteCases ? (
            convertModalOpen ? (
              <div className="mt-3 space-y-2">
                <label className="docket block text-muted-foreground" htmlFor="convert-practice-area">
                  {t('tlPracticeArea')}
                </label>
                <Select value={matterType} onValueChange={(v) => v && setMatterType(v)}>
                  <SelectTrigger id="convert-practice-area" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceAreaOptions.map((a) => (
                      <SelectItem key={a} value={a} className="text-xs">
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 flex-1" disabled={convertPending} onClick={onConvert}>
                    {t('tlOpenMatter')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setConvertModalOpen(false)}>
                    {t('tlCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-2 h-8" onClick={() => setConvertModalOpen(true)}>
                <Briefcase aria-hidden />
                {t('tlOpenMatter')}
              </Button>
            )
          ) : null}
        </section>
      )}

      {escalation?.handoffBrief ? (
        <section>
          <p className="docket mb-2 text-muted-foreground">{t('navHandoff')}</p>
          <HandoffBriefView reason={escalation.handoffReason} excerpt={escalation.detectedExcerpt} brief={escalation.handoffBrief} />
        </section>
      ) : null}

      <section>
        <p className="docket mb-2 text-muted-foreground">{t('tlQuickActions')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button nativeButton={false} variant="outline" size="sm" className="h-9 justify-start" render={<Link href="/dashboard/calendar" />}>
            <Calendar aria-hidden />
            {t('tlBook')}
          </Button>
          <Button nativeButton={false} variant="outline" size="sm" className="h-9 justify-start" render={<Link href="/dashboard/payments" />}>
            <Coins aria-hidden />
            {t('payments')}
          </Button>
          <Button nativeButton={false} variant="outline" size="sm" className="col-span-2 h-9 justify-start" render={<Link href="/dashboard/documents" />}>
            <FileText aria-hidden />
            {t('tlRequestDoc')}
          </Button>
        </div>
      </section>
    </div>
  );
}
