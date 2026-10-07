'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Briefcase,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  shouldShowDayChip,
  waAvatarColor,
  waInitials,
} from '@/components/inbox/wa-format';
import type { InboxDetail, InboxMessage, ConversationState } from '@/lib/schemas/inbox';

const states: ConversationState[] = ['AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED'];
const stateLabel: Record<ConversationState, string> = {
  AI_ACTIVE: 'AI Auto-Pilot',
  HUMAN_REQUIRED: 'Needs Lawyer',
  HUMAN_ACTIVE: 'Lawyer Active',
  CLOSED: 'Closed',
};

interface ConversationDetailProps {
  detail: InboxDetail;
  onBack: () => void;
}

function DeliveryStatusIcon({ status }: { status: string }) {
  if (status === 'QUEUED') {
    return <Clock className="h-3 w-3 text-muted-foreground/70" aria-label="Queued" />;
  }
  if (status === 'FAILED') {
    return <span className="text-[10px] font-bold text-destructive" aria-label="Failed">!</span>;
  }
  if (status === 'SENT') {
    return <Check className="h-3 w-3 text-muted-foreground" aria-label="Sent" />;
  }
  return (
    <CheckCheck
      className={cn('h-3 w-3', status === 'READ' ? 'text-primary' : 'text-muted-foreground')}
      aria-label={status === 'READ' ? 'Read' : 'Delivered'}
    />
  );
}

function MediaAttachment({ m, inbound }: { m: InboxMessage; inbound: boolean }) {
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
        className="mt-1 max-h-72 max-w-full rounded-md border border-border/60 object-cover shadow-2xs"
      />
    );
  }
  if (m.contentType === 'DOCUMENT' && m.mediaUrl) {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-2.5 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs transition-colors hover:bg-muted"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
          <FileText className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">Document File</p>
          <p className="text-[10px] text-muted-foreground">Click to view &amp; download</p>
        </div>
        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    );
  }
  return null;
}

function CallTimelineCard({ message }: { message: InboxMessage }) {
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
    <div className="mx-auto my-2 flex w-full max-w-md items-start gap-3 rounded-lg border border-border/80 bg-card/60 p-3 shadow-2xs">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Phone className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">{t('inboxCallTitle')}</p>
          <span className="text-[10px] text-muted-foreground tabular-nums">{duration}</span>
        </div>
        <p className="text-xs text-muted-foreground">{outcome}</p>
        {message.call?.summary && (
          <p className="mt-1 rounded bg-muted/60 p-2 text-xs text-foreground/90 italic">
            &ldquo;{message.call.summary}&rdquo;
          </p>
        )}
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
  const [composerMode, setComposerMode] = useState<'REPLY' | 'NOTE'>('REPLY');
  const [contextOpen, setContextOpen] = useState(true);
  const [noteBody, setNoteBody] = useState('');
  const [matterType, setMatterType] = useState(practiceAreaOptions[0] ?? 'Other');
  const [convertModalOpen, setConvertModalOpen] = useState(false);
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
      toast.success('Assignment updated');
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
      toast.success('Conversation status updated');
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
      toast.success('Internal note added');
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
      toast.success(`Case ${data.reference} created successfully`);
      setConvertModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      router.push(`/dashboard/cases`);
    },
    onError: () => toast.error('Could not create case'),
  });

  const approveDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('AI draft approved & dispatched');
      void queryClient.invalidateQueries({ queryKey: ['inbox', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/v1/inbox/${conversation.id}/drafts/${messageId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('AI draft discarded');
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

  const windowOpen =
    conversation.sessionWindowExpiresAt &&
    new Date(conversation.sessionWindowExpiresAt) > new Date();

  const displayName = conversation.client.name ?? conversation.client.waPhone;
  const notesCount = notesQuery.data?.length ?? 0;
  const openEscalation = handoffQuery.data?.[0];

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
      {/* Central Timeline Pane */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border/50">
        {/* Operational Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card/60 px-3.5 backdrop-blur-xs">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 shrink-0 text-muted-foreground"
              onClick={onBack}
              aria-label="Back to inbox"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-2xs"
              style={{ background: waAvatarColor(conversation.client.waPhone) }}
              aria-hidden
            >
              {waInitials(conversation.client.name, conversation.client.waPhone)}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {displayName}
                </h2>
                {conversation.case?.reference ? (
                  <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-primary/40 text-primary">
                    {conversation.case.reference}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-[11px] text-muted-foreground font-mono">
                {conversation.client.waPhone}
              </p>
            </div>
          </div>

          {/* Quick Controls in Header */}
          <div className="flex items-center gap-2">
            {/* 24h WhatsApp Session Status Chip */}
            <div
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                windowOpen
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
              )}
              title={
                windowOpen
                  ? '24-hour customer service window active. Freeform replies permitted.'
                  : '24-hour window expired. Client must message first or approved Meta template required.'
              }
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  windowOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
                )}
              />
              <span>{windowOpen ? '24h Window Active' : '24h Window Closed'}</span>
            </div>

            {/* State Picker */}
            {canWriteInbox && (
              <Select
                value={conversation.state}
                onValueChange={(v) => stateMutation.mutate(v as ConversationState)}
                disabled={stateMutation.isPending}
              >
                <SelectTrigger className="h-7 text-xs px-2 min-w-[110px] max-w-[130px] border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {states.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {stateLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Assignee Picker */}
            {canWriteInbox && (
              <Select
                value={conversation.assignedTo?.id ?? '__none__'}
                onValueChange={(v) => assignMutation.mutate(v === '__none__' ? null : v)}
                disabled={assignMutation.isPending}
              >
                <SelectTrigger className="h-7 text-xs px-2 min-w-[110px] max-w-[130px] border-border/80 hidden lg:flex">
                  <span className="truncate">
                    {conversation.assignedTo?.name ?? 'Unassigned'}
                  </span>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="__none__" className="text-xs">Unassigned</SelectItem>
                  {(assignees.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name} ({u.roleName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Context Panel Toggle */}
            <Button
              variant="outline"
              size="icon"
              className={cn('h-7 w-7 text-muted-foreground', contextOpen && 'bg-accent text-accent-foreground')}
              onClick={() => setContextOpen((v) => !v)}
              title={contextOpen ? 'Hide Matter Context' : 'Show Matter Context'}
              aria-label="Toggle matter context"
            >
              {contextOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </header>

        {/* Action Banners */}

        {/* 1. Open Escalation / Lawyer Brief Banner */}
        {conversation.state === 'HUMAN_REQUIRED' && openEscalation && (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                      Lawyer Attention Required
                    </p>
                    <Badge variant="destructive" className="h-4 text-[9px] px-1.5 uppercase">
                      {openEscalation.triggerType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/80 font-medium">
                    {openEscalation.handoffReason ?? 'AI detected urgent legal situation requiring immediate human intervention.'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => router.push('/dashboard/escalations')}
              >
                Open in Escalations
              </Button>
            </div>
          </div>
        )}

        {/* 2. AI Draft Approval Card */}
        {conversation.pendingDraft && (
          <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bot className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    AI Response Draft · Human Review Required
                  </p>
                  <span className="text-[10px] text-muted-foreground">Drafted by Wakeel AI</span>
                </div>
                <div className="mt-2 rounded-md border border-amber-500/20 bg-background/80 p-2.5">
                  <Textarea
                    value={draftEditBody}
                    onChange={(e) => setDraftEditBody(e.target.value)}
                    dir="auto"
                    rows={2}
                    className="min-h-12 w-full border-0 bg-transparent p-0 text-xs text-foreground focus-visible:ring-0 shadow-none leading-relaxed"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  {canWriteInbox ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={approveDraftMutation.isPending}
                        onClick={() => approveDraftMutation.mutate(conversation.pendingDraft!.messageId)}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Approve &amp; Send to WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        disabled={rejectDraftMutation.isPending}
                        onClick={() => rejectDraftMutation.mutate(conversation.pendingDraft!.messageId)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Discard Draft
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('inboxViewOnlyHint')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Pending Payment Proof Card */}
        {conversation.pendingPayment?.proofMessageId && (
          <div className="border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Coins className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    {t('inboxPaymentProofTitle')}
                  </p>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {conversation.pendingPayment.currency}{' '}
                    {(conversation.pendingPayment.amountCents / 100).toLocaleString('en-PK')}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {conversation.pendingPayment.description ?? 'Consultation fee retainer'}
                </p>
                {(() => {
                  const proof = messages.find((m) => m.id === conversation.pendingPayment?.proofMessageId);
                  if (!proof?.mediaUrl) return null;
                  return (
                    <a
                      href={proof.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block max-w-[200px] overflow-hidden rounded-md border border-border/80 hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proof.mediaUrl}
                        alt="Payment proof screenshot"
                        className="max-h-24 w-auto object-cover"
                      />
                    </a>
                  );
                })()}
                {can('payments:write') && (
                  <div className="mt-2.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={verifyPaymentMutation.isPending}
                      onClick={() => verifyPaymentMutation.mutate(conversation.pendingPayment!.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t('inboxPaymentVerify')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
          {/* Top Encrypted Guarantee Banner */}
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground shadow-2xs">
            <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden />
            <span>End-to-end operational audit trail active</span>
          </div>

          {messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('inboxNoMessages')}
            </div>
          ) : (
            messages.map((m, index) => {
              const isInbound = m.direction === 'INBOUND';
              const isAi = m.senderType === 'AI';
              const isLawyer = m.senderType === 'LAWYER' || m.senderType === 'STAFF';
              const isCall = m.contentType === 'CALL' || Boolean(m.call);

              if (isCall) {
                return (
                  <div key={m.id}>
                    {shouldShowDayChip(messages, index) && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {formatWaDayLabel(m.createdAt, t('today'), t('inboxYesterday'))}
                        </span>
                      </div>
                    )}
                    <CallTimelineCard message={m} />
                  </div>
                );
              }

              if (m.senderType === 'SYSTEM') {
                return (
                  <div key={m.id} className="my-2 flex justify-center">
                    <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-0.5 text-[11px] text-muted-foreground">
                      {m.body ?? m.contentType}
                    </span>
                  </div>
                );
              }

              return (
                <div key={m.id}>
                  {shouldShowDayChip(messages, index) && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {formatWaDayLabel(m.createdAt, t('today'), t('inboxYesterday'))}
                      </span>
                    </div>
                  )}

                  <div className={cn('flex w-full', isInbound ? 'justify-start' : 'justify-end')}>
                    <div
                      className={cn(
                        'relative max-w-[85%] sm:max-w-[75%] rounded-xl px-3.5 py-2.5 shadow-2xs text-xs leading-relaxed transition-all',
                        isInbound
                          ? 'bg-card border border-border/80 text-foreground'
                          : isAi
                            ? 'bg-muted/70 border border-primary/20 text-foreground'
                            : isLawyer
                              ? 'bg-primary/10 border border-primary/30 text-foreground'
                              : 'bg-accent border border-border text-foreground',
                      )}
                    >
                      {/* Message Header Label */}
                      <div className="mb-1 flex items-center justify-between gap-2 border-b border-border/30 pb-1">
                        <div className="flex items-center gap-1.5">
                          {isInbound ? (
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {displayName}
                            </span>
                          ) : isAi ? (
                            <span className="font-semibold text-primary flex items-center gap-1">
                              <Bot className="h-3 w-3 text-primary" />
                              AI SENT
                            </span>
                          ) : (
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-primary" />
                              {m.senderName ?? 'Advocate'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                          <span>{formatWaClock(m.createdAt)}</span>
                          {!isInbound && <DeliveryStatusIcon status={m.deliveryStatus} />}
                        </div>
                      </div>

                      {/* Attachment preview if media */}
                      <MediaAttachment m={m} inbound={isInbound} />

                      {/* Body text with Urdu auto-direction */}
                      {m.body && (
                        <p dir="auto" className="whitespace-pre-wrap leading-relaxed mt-1">
                          {m.body}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Composer Bar */}
        <div className="shrink-0 border-t border-border/70 bg-card/70 p-3 backdrop-blur-xs">
          {/* Mode switch & 24h notice */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-md bg-muted/60 p-0.5 border border-border/60">
              <button
                type="button"
                onClick={() => setComposerMode('REPLY')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  composerMode === 'REPLY'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                WhatsApp Message
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('NOTE')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  composerMode === 'NOTE'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Internal Note
              </button>
            </div>

            {!windowOpen && composerMode === 'REPLY' && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                24h window closed — client must message first or use approved Meta template
              </span>
            )}
          </div>

          {composerMode === 'REPLY' ? (
            <div className="flex items-end gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={windowOpen ? t('inboxReplyPlaceholder') : t('inboxReplyClosed')}
                disabled={!windowOpen || !canWriteInbox || replyMutation.isPending}
                rows={2}
                dir="auto"
                className="min-h-12 max-h-36 flex-1 resize-none text-xs leading-relaxed border-border/80 focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (reply.trim() && windowOpen) replyMutation.mutate(reply.trim());
                  }
                }}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                disabled={!reply.trim() || !windowOpen || !canWriteInbox || replyMutation.isPending}
                onClick={() => replyMutation.mutate(reply.trim())}
                aria-label={t('inboxSendReply')}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write an internal staff memo (not visible to client on WhatsApp)…"
                rows={2}
                className="min-h-12 max-h-36 flex-1 resize-none text-xs leading-relaxed border-amber-500/40 bg-amber-500/5 focus-visible:ring-1 focus-visible:ring-amber-500 shadow-2xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (noteBody.trim()) addNoteMutation.mutate(noteBody.trim());
                  }
                }}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                disabled={!noteBody.trim() || addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate(noteBody.trim())}
                aria-label="Save internal note"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Press Enter ↵ to send · Shift+Enter for new line</span>
            {replyMutation.isError && (
              <span className="text-destructive font-medium">Failed to send message</span>
            )}
          </div>
        </div>
      </div>

      {/* Right Context / Client / Case Panel (Collapsible) */}
      {contextOpen && (
        <aside className="w-80 shrink-0 border-l border-border/70 bg-card/40 backdrop-blur-xs flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Matter &amp; Client File
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setContextOpen(false)}
              aria-label="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 p-3.5 text-xs">
            {/* Section 1: Client Overview */}
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Client Profile
                </span>
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  WhatsApp Verified
                </Badge>
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{displayName}</p>
                <p className="font-mono text-muted-foreground">{conversation.client.waPhone}</p>
              </div>
              <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Conversation ID:</span>
                  <span className="font-mono">{conversation.id.slice(0, 8)}…</span>
                </div>
                <div className="flex justify-between">
                  <span>Current State:</span>
                  <span className="font-medium text-foreground">{stateLabel[conversation.state]}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Case Association */}
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  Linked Matter
                </span>
              </div>

              {conversation.case ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded bg-muted/60 p-2">
                    <div>
                      <p className="font-mono font-bold text-foreground text-xs">
                        {conversation.case.reference}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Active Case Record</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      onClick={() => router.push(`/dashboard/cases`)}
                      aria-label="View case"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    This client inquiry is not yet linked to a formal case matter.
                  </p>
                  {canWriteCases && (
                    <>
                      {convertModalOpen ? (
                        <div className="space-y-2 rounded border border-border p-2 bg-muted/30">
                          <label className="text-[10px] font-medium text-muted-foreground block">
                            Practice Area
                          </label>
                          <Select value={matterType} onValueChange={(v) => v && setMatterType(v)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {practiceAreaOptions.map((a) => (
                                <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1 pt-1">
                            <Button
                              size="sm"
                              className="h-6 text-[11px] flex-1 bg-primary text-primary-foreground"
                              disabled={convertMutation.isPending}
                              onClick={() => convertMutation.mutate()}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px]"
                              onClick={() => setConvertModalOpen(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs border-dashed"
                          onClick={() => setConvertModalOpen(true)}
                        >
                          <Briefcase className="h-3 w-3 mr-1" />
                          Convert to Legal Case
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: AI Handoff Brief (if available) */}
            {openEscalation?.handoffBrief && (
              <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI Case Brief
                </span>
                <HandoffBriefView
                  reason={openEscalation.handoffReason}
                  excerpt={openEscalation.detectedExcerpt}
                  brief={openEscalation.handoffBrief}
                />
              </div>
            )}

            {/* Section 4: Internal Staff Notes */}
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Internal Memos ({notesCount})
                </span>
              </div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {(notesQuery.data ?? []).map((n) => (
                  <div key={n.id} className="rounded bg-muted/50 p-2 text-[11px]">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{n.author.name}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground leading-normal">{n.body}</p>
                  </div>
                ))}
                {notesCount === 0 && (
                  <p className="py-2 text-center text-[11px] italic text-muted-foreground">
                    No internal notes on this file.
                  </p>
                )}
              </div>
            </div>

            {/* Section 5: Quick Operations */}
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
                Quick Actions
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] justify-start"
                  onClick={() => router.push('/dashboard/calendar')}
                >
                  <Calendar className="h-3 w-3 mr-1 text-primary" />
                  Appointment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] justify-start"
                  onClick={() => router.push('/dashboard/payments')}
                >
                  <Coins className="h-3 w-3 mr-1 text-emerald-600" />
                  Payment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] justify-start"
                  onClick={() => router.push('/dashboard/documents')}
                >
                  <FileText className="h-3 w-3 mr-1 text-primary" />
                  Document
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] justify-start"
                  onClick={() => router.push('/dashboard/voice')}
                >
                  <Phone className="h-3 w-3 mr-1 text-primary" />
                  Voice Note
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
