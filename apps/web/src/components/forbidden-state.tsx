'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language';

export function ForbiddenState({
  title,
  description,
  showHome = true,
}: {
  title?: string;
  description?: string;
  showHome?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldOff className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">{title ?? t('accessDenied')}</h1>
      <p className="text-sm text-muted-foreground">{description ?? t('accessDeniedDescription')}</p>
      {showHome ? (
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          {t('goToOverview')}
        </Button>
      ) : null}
    </div>
  );
}
