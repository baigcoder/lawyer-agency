'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  CheckCircle2,
  MessageCircleMore,
  Settings as SettingsIcon,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { WhatsappConnectionCard } from '@/components/whatsapp-connection-card';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { evolutionConnectionStatusSchema } from '@/lib/schemas/whatsapp';
import { aiSettingsSchema } from '@/lib/schemas/ai-settings';
import { cn } from '@/lib/utils';

export default function WhatsappPage() {
  const { t } = useLanguage();

  const connection = useQuery({
    queryKey: ['whatsapp', 'connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
  });
  const aiSettings = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => apiRequest('/v1/firm-profile/ai-settings', { schema: aiSettingsSchema }),
    retry: false,
  });

  const connected = connection.data?.status === 'connected';
  const autoReply = aiSettings.data?.aiAutoReplyEnabled ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={MessageCircleMore}
        title={t('whatsapp')}
        description={t('whatsappPageDescription')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                connected
                  ? 'bg-primary/10 text-primary ring-primary/20'
                  : 'bg-muted text-muted-foreground ring-border',
              )}
            >
              <Smartphone className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('connectionStatus')}</p>
              <p className={cn('text-xs', connected ? 'text-primary' : 'text-muted-foreground')}>
                {connection.isPending
                  ? t('checking')
                  : connected
                    ? `${t('whatsappConnected')}${connection.data?.phoneNumber ? ` · +${connection.data.phoneNumber}` : ''}`
                    : t('whatsappNotConnected')}
              </p>
            </div>
            {connected && <CheckCircle2 className="ms-auto h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                autoReply
                  ? 'bg-primary/10 text-primary ring-primary/20'
                  : 'bg-muted text-muted-foreground ring-border',
              )}
            >
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('aiAutoReply')}</p>
              <p className={cn('text-xs', autoReply ? 'text-primary' : 'text-muted-foreground')}>
                {autoReply ? t('aiAutoReplyOn') : t('aiAutoReplyOff')}
              </p>
            </div>
            <Button
              nativeButton={false}
              variant="ghost"
              size="icon"
              className="ms-auto shrink-0"
              aria-label={t('settings')}
              render={<Link href="/dashboard/settings" />}
            >
              <SettingsIcon className="h-4 w-4" aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>

      <WhatsappConnectionCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('howWhatsappWorks')}</CardTitle>
          <CardDescription>{t('howWhatsappWorksDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {[
              t('whatsappHowStep1'),
              t('whatsappHowStep2'),
              t('whatsappHowStep3'),
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
