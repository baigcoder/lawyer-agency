'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Loader2, MessageSquareText, Mic, Phone, Send, Settings as SettingsIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { aiSettingsSchema, type AiSettings } from '@/lib/schemas/ai-settings';
import { cn } from '@/lib/utils';

type ChannelPatch = {
  aiEnabled?: boolean;
  aiReply?: boolean;
  chat?: boolean;
  voice?: boolean;
  callsTakenBy?: 'off' | 'ai';
};

function isChatOn(settings: AiSettings): boolean {
  return settings.aiVoiceReplyMode !== 'voice_only';
}

function isVoiceOn(settings: AiSettings): boolean {
  return settings.aiVoiceEnabled && settings.aiVoiceReplyMode !== 'text_only';
}

function applyAiControlPatch(current: AiSettings, patch: ChannelPatch): AiSettings | null {
  const next: AiSettings = { ...current };
  if (patch.aiEnabled !== undefined) {
    next.aiAutoReplyEnabled = patch.aiEnabled;
  }
  if (patch.aiReply !== undefined) {
    next.aiAutoReplyRequiresApproval = !patch.aiReply;
  }

  const chatOn = patch.chat ?? isChatOn(current);
  const voiceOn = patch.voice ?? isVoiceOn(current);
  if (!chatOn && !voiceOn) {
    return null;
  }
  next.aiVoiceEnabled = voiceOn;
  next.aiVoiceReplyMode = voiceOn && !chatOn ? 'voice_only' : voiceOn ? 'auto' : 'text_only';
  if (patch.callsTakenBy !== undefined) {
    next.callsTakenBy = patch.callsTakenBy;
  } else if (patch.voice === true) {
    next.callsTakenBy = 'ai';
  }
  return next;
}

export function AiControls({ canManage }: { canManage: boolean }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => apiRequest('/v1/firm-profile/ai-settings', { schema: aiSettingsSchema }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (body: AiSettings) =>
      apiRequest('/v1/firm-profile/ai-settings', { method: 'PUT', body, schema: aiSettingsSchema }),
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-settings'], data);
      queryClient.setQueryData(['ai-auto-reply'], { aiAutoReplyEnabled: data.aiAutoReplyEnabled });
      toast.success(t('overviewAiControlsSaved'));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('overviewAiControlsSaveFailed'));
    },
  });

  const apply = (patch: ChannelPatch) => {
    if (!settings.data || mutation.isPending) return;
    const next = applyAiControlPatch(settings.data, patch);
    if (!next) {
      toast.error(t('overviewAiKeepChannel'));
      return;
    }
    mutation.mutate(next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" aria-hidden />
              {t('overviewAiControls')}
            </CardTitle>
            <CardDescription>{t('overviewAiControlsDesc')}</CardDescription>
          </div>
          {canManage ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/dashboard/settings#ai" />}
            >
              <SettingsIcon className="h-4 w-4" aria-hidden />
              {t('overviewAiConfigure')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('overviewAiVoiceSettingsHint')}</p>
      </CardHeader>
      <CardContent>
        {settings.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label={t('overviewAiControls')}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : null}
        {settings.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {settings.error instanceof ApiError ? settings.error.message : t('overviewAiControlsSaveFailed')}
          </p>
        ) : null}
        {settings.data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AiToggle
              icon={Zap}
              label={t('overviewAiEnable')}
              hint={t('overviewAiEnableHint')}
              checked={settings.data.aiAutoReplyEnabled}
              disabled={!canManage || mutation.isPending}
              pending={mutation.isPending}
              emphasize={settings.data.aiAutoReplyEnabled}
              onCheckedChange={(checked) => apply({ aiEnabled: checked })}
            />
            <AiToggle
              icon={Send}
              label={t('overviewAiReply')}
              hint={t('overviewAiReplyHint')}
              checked={!settings.data.aiAutoReplyRequiresApproval}
              disabled={!canManage || mutation.isPending}
              pending={mutation.isPending}
              onCheckedChange={(checked) => apply({ aiReply: checked })}
            />
            <AiToggle
              icon={MessageSquareText}
              label={t('overviewAiChat')}
              hint={t('overviewAiChatHint')}
              checked={isChatOn(settings.data)}
              disabled={!canManage || mutation.isPending}
              pending={mutation.isPending}
              onCheckedChange={(checked) => apply({ chat: checked })}
            />
            <AiToggle
              icon={Mic}
              label={t('overviewAiVoice')}
              hint={t('overviewAiVoiceHint')}
              checked={isVoiceOn(settings.data)}
              disabled={!canManage || mutation.isPending}
              pending={mutation.isPending}
              onCheckedChange={(checked) => apply({ voice: checked })}
            />
            <AiToggle
              icon={Phone}
              label={t('overviewAiTakesCalls')}
              hint={t('overviewAiTakesCallsHint')}
              checked={settings.data.callsTakenBy === 'ai'}
              disabled={!canManage || mutation.isPending}
              pending={mutation.isPending}
              emphasize={settings.data.callsTakenBy === 'ai'}
              onCheckedChange={(checked) => apply({ callsTakenBy: checked ? 'ai' : 'off' })}
            />
          </div>
        ) : null}
        {!canManage ? (
          <p className="mt-3 text-xs text-muted-foreground">{t('overviewAiControlsNeedOwner')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AiToggle({
  icon: Icon,
  label,
  hint,
  checked,
  disabled,
  pending,
  emphasize,
  onCheckedChange,
}: {
  icon: typeof Zap;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  pending: boolean;
  emphasize?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border p-4',
        emphasize ? 'border-primary/30 bg-primary/5' : 'bg-muted/30',
        disabled && 'opacity-70',
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
        <Switch
          size="sm"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={label}
        />
      </div>
    </div>
  );
}
