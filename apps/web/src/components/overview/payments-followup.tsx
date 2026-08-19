'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, humanizeEnum } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import type { PaymentDto } from '@/lib/schemas/payment';

const OUTSTANDING = new Set(['REQUESTED', 'PENDING']);

export function PaymentsFollowup({
  items,
  isPending,
  isError,
}: {
  items: PaymentDto[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const { t } = useLanguage();
  const outstanding = (items ?? []).filter((p) => OUTSTANDING.has(p.status)).slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" aria-hidden />
              {t('paymentFollowUps')}
            </CardTitle>
            <CardDescription>{t('paymentFollowUpsDetail')}</CardDescription>
          </div>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/payments" />}>
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
            {t('couldNotLoadPayments')}
          </p>
        ) : null}
        {!isPending && !isError && outstanding.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noOutstandingPayments')}</p>
        ) : null}
        {outstanding.map((payment) => (
          <Link
            key={payment.id}
            href="/dashboard/payments"
            className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{formatMoney(payment.amountCents, payment.currency)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {payment.description ?? payment.case?.reference ?? humanizeEnum(payment.method)}
              </p>
            </div>
            <Badge variant="outline">{humanizeEnum(payment.status)}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
