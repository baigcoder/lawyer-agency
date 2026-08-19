'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { QrCode, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { evolutionConnectionStatusSchema } from '@/lib/schemas/whatsapp';
import { useSession } from '@/lib/session';

export function HeaderWhatsappStatus() {
  const { t } = useLanguage();
  const { can } = useSession();
  const canManage = can('whatsapp:manage');
  const connection = useQuery({
    queryKey: ['whatsapp', 'connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'connecting' ? 2_000 : 15_000),
  });

  const status = connection.data?.status ?? 'disconnected';
  const connected = status === 'connected';
  const number = connection.data?.phoneNumber
    ? `+${connection.data.phoneNumber}`
    : connection.data?.displayName;

  if (connection.isPending) return null;

  if (connected || !canManage) {
    return (
      <Badge
        variant="outline"
        className="hidden h-8 max-w-[12rem] gap-1.5 truncate sm:inline-flex"
        render={<Link href="/dashboard/whatsapp" />}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground'}`} aria-hidden />
        {connected ? (number ?? t('whatsappConnected')) : t('whatsappNotConnected')}
      </Badge>
    );
  }

  return (
    <Button
      nativeButton={false}
      variant="outline"
      size="sm"
      className="hidden sm:inline-flex"
      render={<Link href="/dashboard/whatsapp" />}
    >
      {status === 'connecting' ? (
        <Smartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      ) : (
        <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      )}
      {status === 'connecting' ? t('scanQrToConnect') : t('connectWhatsapp')}
    </Button>
  );
}
