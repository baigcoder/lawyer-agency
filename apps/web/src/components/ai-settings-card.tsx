'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Loader2, Sparkles, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import {
  aiSettingsSchema,
  generateIntroResultSchema,
  voiceListSchema,
  voicePreviewSchema,
  type AiSettings,
} from '@/lib/schemas/ai-settings';
import { firmProfileSchema } from '@/lib/schemas/firm-profile';
import { cn } from '@/lib/utils';

const toneOptions = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'concise', label: 'Concise' },
] as const;

const DEFAULT_PREVIEW_VOICE = {
  female: 'FGY2WhTYpPnrIDTdsKH5',
  male: 'JBFqnCBsd6RMkjVDRZzb',
} as const;

export function AiSettingsCard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileSchema }),
  });
  const settings = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => apiRequest('/v1/firm-profile/ai-settings', { schema: aiSettingsSchema }),
  });
  const voices = useQuery({
    queryKey: ['ai-voices'],
    queryFn: () => apiRequest('/v1/voice/voices', { schema: voiceListSchema }),
  });

  const form = useForm<AiSettings>({
    resolver: zodResolver(aiSettingsSchema),
    values: settings.data,
  });

  const mutation = useMutation({
    mutationFn: (body: AiSettings) =>
      apiRequest('/v1/firm-profile/ai-settings', { method: 'PUT', body, schema: aiSettingsSchema }),
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-settings'], data);
      queryClient.setQueryData(['ai-auto-reply'], { aiAutoReplyEnabled: data.aiAutoReplyEnabled });
      toast.success('AI settings saved');
    },
    onError: () => toast.error('Could not save AI settings.'),
  });

  const generateIntro = useMutation({
    mutationFn: (language: 'en' | 'ur') =>
      apiRequest('/v1/firm-profile/ai-settings/generate-intro', {
        method: 'POST',
        body: { language },
        schema: generateIntroResultSchema,
      }),
    onSuccess: (data) => {
      form.setValue('aiGreetingIntro', data.intro, { shouldDirty: true, shouldValidate: true });
      toast.success(data.source === 'template' ? t('aiIntroFetchedTemplate') : t('aiIntroFetched'));
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('aiCouldNotFetchIntro')),
  });

  const previewVoice = useMutation({
    mutationFn: (input: { voiceId: string; language: 'en' | 'ur' }) =>
      apiRequest('/v1/voice/preview', { method: 'POST', body: input, schema: voicePreviewSchema }),
    onSuccess: (data) => {
      const url = audioSrcFromPreview(data.mimeType, data.audioBase64);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('aiCouldNotPreviewVoice')),
  });

  useEffect(() => {
    if (!previewUrl) return;
    const player = playerRef.current;
    if (!player) return;
    player.load();
    void player.play().catch(() => {
      // Autoplay is often blocked after the async fetch; the visible player is the fallback.
    });
  }, [previewUrl]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const displayName = profile.data?.displayName ?? profile.data?.firmName ?? 'Your firm';
  const previewIntro = (form.watch('aiGreetingIntro') || '').replace(/\{\{displayName\}\}/g, displayName);
  const introIsUrdu = /[\u0600-\u06FF]/.test(previewIntro);
  const selectedVoiceId = form.watch('aiVoiceId');
  const voiceGender = form.watch('aiVoiceGender');

  if (settings.isPending) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading AI settings…</span>
        </CardContent>
      </Card>
    );
  }

  if (settings.isError || !settings.data) {
    const message =
      settings.error instanceof ApiError ? settings.error.message : 'Could not load AI settings.';
    return (
      <Card>
        <CardContent className="py-8">
          <p role="alert" className="text-sm text-destructive">{message}</p>
        </CardContent>
      </Card>
    );
  }

  const playPreview = (language: 'en' | 'ur') => {
    const gender = voiceGender === 'male' ? 'male' : 'female';
    const voiceId =
      selectedVoiceId ||
      voices.data?.voices.find((voice) => voice.gender === gender)?.id ||
      voices.data?.voices[0]?.id ||
      DEFAULT_PREVIEW_VOICE[gender];
    previewVoice.mutate({ voiceId, language });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" /> {t('aiSettingsTitle')}
        </CardTitle>
        <CardDescription>{t('aiSettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">AI auto-reply</Label>
              <p className="text-xs text-muted-foreground">
                When off, new messages go to staff without AI processing.
              </p>
            </div>
            <Switch
              checked={form.watch('aiAutoReplyEnabled')}
              onCheckedChange={(checked) => form.setValue('aiAutoReplyEnabled', checked, { shouldDirty: true })}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Require staff approval before AI sends</Label>
              <p className="text-xs text-muted-foreground">
                AI drafts replies in the inbox; a team member approves before WhatsApp delivery.
              </p>
            </div>
            <Switch
              checked={form.watch('aiAutoReplyRequiresApproval')}
              onCheckedChange={(checked) =>
                form.setValue('aiAutoReplyRequiresApproval', checked, { shouldDirty: true })
              }
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t('aiLanguagePolicy')}</p>
              <p className="text-xs text-muted-foreground">{t('aiLanguagePolicyHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'mirror', label: t('aiLanguageMirror') },
                { value: 'english_only', label: t('aiLanguageEnglish') },
                { value: 'urdu_preferred', label: t('aiLanguageUrduPreferred') },
              ] as const).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={form.watch('aiLanguagePolicy') === opt.value ? 'default' : 'outline'}
                  onClick={() => form.setValue('aiLanguagePolicy', opt.value, { shouldDirty: true })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Urdu replies enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Allow Urdu script when the client writes Urdu.
                </p>
              </div>
              <Switch
                checked={form.watch('aiUrduReplyEnabled')}
                onCheckedChange={(checked) => form.setValue('aiUrduReplyEnabled', checked, { shouldDirty: true })}
              />
            </div>
          </div>

          <Field
            label={t('aiGreetingIntroLabel')}
            hint={t('aiGreetingIntroHint')}
            error={form.formState.errors.aiGreetingIntro?.message}
          >
            <Textarea rows={2} placeholder={t('aiGreetingIntroEmpty')} {...form.register('aiGreetingIntro')} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Name used in every AI reply</p>
              <p className="text-sm font-medium">{displayName}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/settings#firm" />}
            >
              Edit firm name
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={generateIntro.isPending}
              onClick={() => generateIntro.mutate('en')}
            >
              {generateIntro.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('aiFillIntroEn')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={generateIntro.isPending}
              onClick={() => generateIntro.mutate('ur')}
            >
              {generateIntro.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('aiFillIntroUr')}
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <p className={cn('mt-1', introIsUrdu && 'font-urdu')} dir={introIsUrdu ? 'rtl' : 'ltr'}>
              {previewIntro || t('aiGreetingIntroEmpty')}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t('aiAssumptionsTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('aiAssumptionsHint')}</p>
            </div>
            <AssumptionToggle
              label={t('aiFirmScopeOnly')}
              hint={t('aiFirmScopeOnlyHint')}
              checked={form.watch('aiFirmScopeOnly')}
              onCheckedChange={(checked) =>
                form.setValue('aiFirmScopeOnly', checked, { shouldDirty: true })
              }
            />
            <AssumptionToggle
              label={t('aiNeverInvent')}
              hint={t('aiNeverInventHint')}
              checked={form.watch('aiNeverInventCaseFacts')}
              onCheckedChange={(checked) =>
                form.setValue('aiNeverInventCaseFacts', checked, { shouldDirty: true })
              }
            />
            <AssumptionToggle
              label={t('aiAskClarifying')}
              hint={t('aiAskClarifyingHint')}
              checked={form.watch('aiAskClarifyingQuestions')}
              onCheckedChange={(checked) =>
                form.setValue('aiAskClarifyingQuestions', checked, { shouldDirty: true })
              }
            />
            <AssumptionToggle
              label={t('aiMentionFee')}
              hint={t('aiMentionFeeHint')}
              checked={form.watch('aiMentionConsultationFee')}
              onCheckedChange={(checked) =>
                form.setValue('aiMentionConsultationFee', checked, { shouldDirty: true })
              }
            />
            <Field label={t('aiReplyLength')} error={form.formState.errors.aiReplyLength?.message}>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'short', label: t('aiReplyLengthShort') },
                  { value: 'balanced', label: t('aiReplyLengthBalanced') },
                  { value: 'detailed', label: t('aiReplyLengthDetailed') },
                ] as const).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={form.watch('aiReplyLength') === opt.value ? 'default' : 'outline'}
                    onClick={() => form.setValue('aiReplyLength', opt.value, { shouldDirty: true })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="First-message consent text" hint="Shown on the AI disclosure; leave blank for default.">
            <Textarea
              rows={2}
              {...form.register('aiConsentMessage')}
              placeholder="Optional custom consent line for the first AI message…"
            />
          </Field>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('aiVoiceReplyEnabled')}</Label>
              <p className="text-xs text-muted-foreground">{t('aiVoiceReplyEnabledHint')}</p>
            </div>
            <Switch
              checked={form.watch('aiVoiceEnabled')}
              onCheckedChange={(checked) => {
                form.setValue('aiVoiceEnabled', checked, { shouldDirty: true });
                if (checked && form.getValues('aiVoiceReplyMode') === 'text_only') {
                  form.setValue('aiVoiceReplyMode', 'auto', { shouldDirty: true });
                }
              }}
            />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t('aiVoiceSelect')}</p>
              <p className="text-xs text-muted-foreground">{t('aiVoicePreviewHint')}</p>
            </div>
            <Field label="Assistant voice" error={form.formState.errors.aiVoiceGender?.message}>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ] as const).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={form.watch('aiVoiceGender') === opt.value ? 'default' : 'outline'}
                    onClick={() => form.setValue('aiVoiceGender', opt.value, { shouldDirty: true })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </Field>

            <Field label={t('aiVoiceSelect')} hint={t('aiVoiceSelectHint')}>
              <Select
                value={selectedVoiceId || 'default'}
                onValueChange={(value) => {
                  if (!value || value === 'default') {
                    form.setValue('aiVoiceId', '', { shouldDirty: true });
                    return;
                  }
                  form.setValue('aiVoiceId', value, { shouldDirty: true });
                  const voice = voices.data?.voices.find((item) => item.id === value);
                  if (voice?.gender === 'male' || voice?.gender === 'female') {
                    form.setValue('aiVoiceGender', voice.gender, { shouldDirty: true });
                  }
                }}
                disabled={voices.isPending}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={t('aiDefaultVoice')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('aiDefaultVoice')}</SelectItem>
                  {(voices.data?.voices ?? []).map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name} · {voice.gender} · {voice.accent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={previewVoice.isPending || voices.isPending}
                onClick={() => playPreview('en')}
              >
                {previewVoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {t('aiPreviewEn')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={previewVoice.isPending || voices.isPending}
                onClick={() => playPreview('ur')}
              >
                {previewVoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {t('aiPreviewUr')}
              </Button>
            </div>
            {previewUrl ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t('aiVoicePreviewPlayer')}</p>
                <audio ref={playerRef} src={previewUrl} controls preload="auto" className="w-full max-w-md" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('aiVoicePreviewEmpty')}</p>
            )}
            {voices.data && !voices.data.configured ? (
              <p className="text-xs text-muted-foreground">{t('aiElevenLabsMissing')}</p>
            ) : null}

            {form.watch('aiVoiceEnabled') ? (
              <Field label="Voice reply mode" error={form.formState.errors.aiVoiceReplyMode?.message}>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'auto', label: 'Auto (voice when client sent voice)' },
                    { value: 'voice_only', label: 'Always voice' },
                    { value: 'text_only', label: 'Text only' },
                  ] as const).map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={form.watch('aiVoiceReplyMode') === opt.value ? 'default' : 'outline'}
                      onClick={() => form.setValue('aiVoiceReplyMode', opt.value, { shouldDirty: true })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>

          <Field label="Tone" error={form.formState.errors.aiTone?.message}>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={form.watch('aiTone') === opt.value ? 'default' : 'outline'}
                  onClick={() => form.setValue('aiTone', opt.value, { shouldDirty: true })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </Field>

          <Field
            label="Custom instructions"
            hint="Extra rules for the AI (e.g. always mention consultation fee, never discuss fees over chat)"
            error={form.formState.errors.aiCustomInstructions?.message}
          >
            <Textarea rows={4} {...form.register('aiCustomInstructions')} placeholder="Optional" />
          </Field>

          <Field
            label="Handoff message"
            hint="Sent after the AI creates and assigns a real lawyer-review task. You may use {{displayName}} and {{responseTime}}."
            error={form.formState.errors.aiHandoffMessage?.message}
          >
            <Textarea rows={3} {...form.register('aiHandoffMessage')} placeholder="Optional" />
          </Field>

          <Field
            label="Lawyer response-time target"
            hint="Minutes promised during office hours. Set 0 to make no time promise."
            error={form.formState.errors.aiHandoffSlaMinutes?.message}
          >
            <Input
              type="number"
              min={0}
              max={1440}
              className="max-w-40"
              {...form.register('aiHandoffSlaMinutes', { valueAsNumber: true })}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save AI settings
            </Button>
            <Button type="button" variant="outline" nativeButton={false} render={<Link href="/dashboard/knowledge" />}>
              Manage knowledge base
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AssumptionToggle({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 p-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function audioSrcFromPreview(mimeType: string, audioBase64: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
