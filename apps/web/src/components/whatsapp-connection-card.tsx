'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  Plug,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { evolutionConnectionStatusSchema, type EvolutionConnectionStatus } from '@/lib/schemas/whatsapp';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';

function statusMeta(status: EvolutionConnectionStatus['status']) {
  switch (status) {
    case 'connected':
      return { label: 'Connected', color: 'default' as const, dot: 'bg-emerald-500' };
    case 'connecting':
      return { label: 'Connecting', color: 'secondary' as const, dot: 'bg-amber-500' };
    case 'disconnected':
      return { label: 'Disconnected', color: 'destructive' as const, dot: 'bg-muted-foreground' };
    default:
      return { label: status, color: 'outline' as const, dot: 'bg-muted-foreground' };
  }
}

async function toQrDataUrl(qr: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(qr, { width: 240, margin: 1 });
}

function QrImage({ qr }: { qr: string }) {
  // Evolution v2 returns the QR as a ready-made PNG data URL — display it
  // directly. Raw QR content strings (legacy path) are encoded client-side.
  // The key includes a slice of the payload so a rotated QR re-renders.
  const isDataUrl = qr.startsWith('data:');
  const qrKey = isDataUrl ? `direct:${qr.slice(-40)}` : qr;
  const { data: img, isPending } = useQuery({
    queryKey: ['evolution', 'qr-image', qrKey],
    queryFn: () => (isDataUrl ? Promise.resolve(qr) : toQrDataUrl(qr)),
  });
  if (isPending || !img) {
    return (
      <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering QR…
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-muted bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="WhatsApp pairing QR code" className="rounded" width={240} height={240} />
    </div>
  );
}

export function WhatsappConnectionCard() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { can } = useSession();
  const canManage = can('whatsapp:manage');
  const [connectionType, setConnectionType] = useState<'baileys' | 'cloud_api'>('baileys');

  const status = useQuery({
    queryKey: ['whatsapp', 'connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'connecting' ? 2_000 : 10_000),
  });

  const refreshQr = useMutation({
    mutationFn: () =>
      apiRequest('/v1/whatsapp/connection?refreshQr=1', { schema: evolutionConnectionStatusSchema }),
    onSuccess: (data) => {
      queryClient.setQueryData(['whatsapp', 'connection'], data);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not refresh QR.'),
  });

  const connect = useMutation({
    mutationFn: () =>
      apiRequest('/v1/whatsapp/connection', {
        method: 'POST',
        body: { connectionType },
        schema: evolutionConnectionStatusSchema,
      }),
    onSuccess: () => {
      toast.success('WhatsApp connection started');
      void queryClient.invalidateQueries({ queryKey: ['whatsapp', 'connection'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not connect WhatsApp.'),
  });

  const disconnect = useMutation({
    mutationFn: () =>
      apiRequest('/v1/whatsapp/connection', {
        method: 'DELETE',
        schema: evolutionConnectionStatusSchema,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['whatsapp', 'connection'], data);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      toast.success('WhatsApp disconnected');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not disconnect.'),
  });

  const ready = status.data;
  const { label, color, dot } = statusMeta(ready?.status ?? 'disconnected');
  const isConnected = ready?.status === 'connected';
  const isConnecting = ready?.status === 'connecting';
  const showQr = Boolean(ready?.qrCode) && (isConnecting || !isConnected);

  useEffect(() => {
    if (ready?.status === 'connected') {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    }
  }, [queryClient, ready?.status]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5" /> WhatsApp connection
            </CardTitle>
            <CardDescription className="mt-1">
              Link your firm&apos;s WhatsApp number so clients can message you.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${dot} ${isConnected || isConnecting ? 'animate-pulse' : ''}`} />
            <Badge variant={color} className="capitalize">{label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!canManage && !isConnected ? (
          <p className="text-sm text-muted-foreground">{t('askOwnerToConnectWhatsapp')}</p>
        ) : !ready || ready.status === 'disconnected' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={connectionType === 'baileys' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConnectionType('baileys')}
              >
                <QrCode className="mr-1.5 h-4 w-4" /> QR (free)
              </Button>
              <Button
                type="button"
                variant={connectionType === 'cloud_api' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConnectionType('cloud_api')}
              >
                <Plug className="mr-1.5 h-4 w-4" /> Official (Meta)
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {connectionType === 'baileys'
                ? 'Scan a QR code with your phone. Best for small firms and testing.'
                : 'Connect an official WhatsApp Business number for higher volume and templates.'}
            </p>
            <Button type="button" onClick={() => void connect.mutate()} disabled={connect.isPending}>
              {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
              Connect WhatsApp
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Instance</p>
                <p className="mt-0.5 font-medium">{ready.instanceName}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="mt-0.5 font-medium capitalize">{ready.connectionType.replace('_', ' ')}</p>
              </div>
              {ready.phoneNumber ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Number</p>
                  <p className="mt-0.5 font-medium">+{ready.phoneNumber}</p>
                </div>
              ) : null}
            </div>

            {showQr && canManage ? (
              <div className="space-y-3">
                <Separator />
                <p className="text-sm font-medium">Scan to connect</p>
                <QrImage qr={ready.qrCode!} />
                <p className="text-xs text-muted-foreground">
                  Open WhatsApp → Settings → Linked Devices → Link a Device, then scan the QR code.
                </p>
              </div>
            ) : isConnected ? (              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> WhatsApp is connected
                </p>
                <p className="mt-1 text-xs">
                  Incoming messages will be routed to Wakeel. Make sure AI auto-reply is enabled in Settings, or assign staff to reply manually.
                </p>
              </div>
            ) : null}

            {canManage ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (showQr ? void refreshQr.mutate() : void status.refetch())}
                disabled={status.isFetching || refreshQr.isPending}
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${status.isFetching || refreshQr.isPending ? 'animate-spin' : ''}`} />
                {showQr ? 'New QR code' : 'Refresh'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Disconnect
              </Button>
            </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
