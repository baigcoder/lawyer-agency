'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language';

export function SlaBanner({ count }: { count: number }) {
  const { t } = useLanguage();
  if (count <= 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <p className="font-medium text-destructive">
            {count} {count === 1 ? t('slaBreachSingular') : t('slaBreachPlural')}
          </p>
          <p className="text-sm text-muted-foreground">{t('slaBannerDetail')}</p>
        </div>
      </div>
      <Button nativeButton={false} variant="destructive" size="sm" render={<Link href="/dashboard/escalations" />}>
        {t('reviewEscalations')}
      </Button>
    </div>
  );
}
