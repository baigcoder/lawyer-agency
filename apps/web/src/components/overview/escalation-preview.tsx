'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, ApiError } from '@/lib/api-client';
import { formatSlaRemaining } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import {
  escalationSummarySchema,
  triggerLabels,
  type EscalationSummary,
} from '@/lib/schemas/escalations';
import { userListSchema } from '@/lib/schemas/users';

export function EscalationPreview({
  items,
  isPending,
  isError,
}: {
  items: EscalationSummary[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const preview = (items ?? []).slice(0, 3);

  const assignees = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => apiRequest('/v1/users?status=ACTIVE&limit=100', { schema: userListSchema }),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/escalations/${id}/acknowledge`, { method: 'POST', schema: escalationSummarySchema }),
    onSuccess: () => {
      toast.success(t('escalationAcknowledged'));
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotAcknowledge')),
  });

  const assign = useMutation({
    mutationFn: ({ conversationId, assigneeUserId }: { conversationId: string; assigneeUserId: string | null }) =>
      apiRequest(`/v1/inbox/${conversationId}/assign`, {
        method: 'POST',
        body: { assigneeUserId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotAssign')),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-primary" aria-hidden />
              {t('openEscalations')}
            </CardTitle>
            <CardDescription>{t('escalationPreviewDetail')}</CardDescription>
          </div>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/escalations" />}>
            {t('viewAll')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : null}
        {isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('couldntLoadEscalations')}
          </p>
        ) : null}
        {!isPending && !isError && preview.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noOpenEscalations')}</p>
        ) : null}
        {preview.map((item) => (
          <EscalationRow
            key={item.id}
            item={item}
            users={assignees.data ?? []}
            busy={acknowledge.isPending || assign.isPending}
            onAcknowledge={() => acknowledge.mutate(item.id)}
            onAssign={(assigneeUserId) =>
              assign.mutate({ conversationId: item.conversationId, assigneeUserId })
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

function EscalationRow({
  item,
  users,
  busy,
  onAcknowledge,
  onAssign,
}: {
  item: EscalationSummary;
  users: Array<{ id: string; name: string }>;
  busy: boolean;
  onAcknowledge: () => void;
  onAssign: (assigneeUserId: string | null) => void;
}) {
  const { t } = useLanguage();
  const sla = formatSlaRemaining(item.slaDeadline);

  return (
    <div className="space-y-2 rounded-xl border border-border/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            {item.slaBreached || sla.overdue ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            ) : null}
            {triggerLabels[item.triggerType]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {item.client.name ?? item.client.waPhone}
          </p>
        </div>
        <Badge variant={sla.overdue || item.slaBreached ? 'destructive' : 'outline'}>
          {sla.overdue ? `${t('overdue')} ${sla.label}` : `${sla.label} ${t('left')}`}
        </Badge>
      </div>
      {item.detectedExcerpt ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">&ldquo;{item.detectedExcerpt}&rdquo;</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={item.assignedTo?.id ?? '__none__'}
          onValueChange={(v) => onAssign(v === '__none__' ? null : v)}
          disabled={busy}
        >
          <SelectTrigger size="sm" className="h-7 w-36 text-xs">
            <SelectValue placeholder={t('inboxAssignTo')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t('inboxUnassigned')}</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href={`/dashboard/inbox?conversation=${item.conversationId}`} />}
        >
          <ExternalLink className="mr-1 h-3 w-3" aria-hidden />
          {t('openInbox')}
        </Button>
        {item.status === 'OPEN' ? (
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onAcknowledge}>
            {t('acknowledge')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
