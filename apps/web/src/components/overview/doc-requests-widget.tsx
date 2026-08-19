'use client';

import Link from 'next/link';
import { FileWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { daysSince } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import type { DocumentRequestDto } from '@/lib/schemas/document-requests';

export function DocRequestsWidget({
  items,
  isPending,
  isError,
}: {
  items: DocumentRequestDto[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const { t } = useLanguage();
  const pending = (items ?? []).filter((r) => r.status === 'PENDING').slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-4 w-4 text-primary" aria-hidden />
              {t('pendingDocRequests')}
            </CardTitle>
            <CardDescription>{t('pendingDocRequestsDetail')}</CardDescription>
          </div>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/documents" />}>
            {t('viewAll')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : null}
        {isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('couldntLoadDocRequests')}
          </p>
        ) : null}
        {!isPending && !isError && pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noPendingDocRequests')}</p>
        ) : null}
        {pending.map((req) => {
          const waiting = daysSince(req.createdAt);
          return (
            <Link
              key={req.id}
              href="/dashboard/cases"
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{req.clientName ?? t('unknown')}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {req.description}
                  {req.caseReference ? ` · ${req.caseReference}` : ''}
                </p>
              </div>
              <Badge variant={waiting >= 3 ? 'destructive' : 'outline'}>
                {waiting === 0 ? t('today') : `${waiting}d`}
              </Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
