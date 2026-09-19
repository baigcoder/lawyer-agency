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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import {
  aiSettingsSchema,
  generateIntroResultSchema,
  voiceListSchema,
  voicePreviewSchema,
  type AiSettings,
  type TtsVoice,
} from '@/lib/schemas/ai-settings';
import { firmProfileSchema } from '@/lib/schemas/firm-profile';
import { cn } from '@/lib/utils';

type VoiceLanguage = 'en' | 'ur';

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

  const [playing, setPlaying] = useState<{ voiceId: string | undefined; language: VoiceLanguage } | null>(null);
  const previewVoice = useMutation({
    mutationFn: (input: {
      /** Empty previews the default — the voice a reply would use. */
      voiceId: string;
      language: VoiceLanguage;
      voiceGender: 'male' | 'female';
      tone: AiSettings['aiTone'];
      displayName: string;
    }) => apiRequest('/v1/voice/preview', { method: 'POST', body: input, schema: voicePreviewSchema }),
    onSuccess: (data, input) => {
      const url = audioSrcFromPreview(data.mimeType, data.audioBase64);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setPlaying({ voiceId: data.voiceId, language: input.language });
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
  const voiceGender = form.watch('aiVoiceGender') === 'male' ? 'male' : 'female';
  const allVoices = voices.data?.voices ?? [];
  const voicesForGender = allVoices.filter(
    (voice) => voice.gender === voiceGender || voice.gender === 'neutral',
  );
  const defaults = voices.data?.defaults;
  const voiceField = (language: VoiceLanguage) => (language === 'ur' ? 'aiVoiceIdUrdu' : 'aiVoiceId');

  const setVoiceGender = (gender: 'male' | 'female') => {
    form.setValue('aiVoiceGender', gender, { shouldDirty: true });
    // A pick of the other gender drops out of its list; clear it so the voice
    // and the Urdu verb forms (kar sakti / kar sakta) agree.
    for (const field of ['aiVoiceId', 'aiVoiceIdUrdu'] as const) {
      const selected = allVoices.find((voice) => voice.id === form.getValues(field));
      if (selected && selected.gender !== gender && selected.gender !== 'neutral') {
        form.setValue(field, '', { shouldDirty: true });
      }
    }
  };

  // No guessing a voice here: an empty id previews the default on the server,
  // through the same path a reply takes. The old picker previewed the first
  // voice of the gender in the list, which was not what clients heard.
  const playPreview = (language: VoiceLanguage) => {
    previewVoice.mutate({
      voiceId: form.getValues(voiceField(language)),
      language,
      voiceGender,
      tone: form.getValues('aiTone'),
      displayName,
    });
  };

  const playingLabel = (() => {
    if (!playing) return null;
    const name =
      allVoices.find((voice) => voice.id === playing.voiceId)?.name ??
      (playing.voiceId ? playing.voiceId : t('aiDefaultVoiceNamed').replace('{name}', '…'));
    return t('aiVoicePreviewNowPlaying')
      .replace('{voice}', name)
      .replace('{language}', playing.language === 'ur' ? t('aiVoiceLanguageUrdu') : t('aiVoiceLanguageEnglish'));
  })();

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
            <p
              className={cn('mt-1', introIsUrdu && 'font-urdu')}
              dir={introIsUrdu ? 'rtl' : 'ltr'}
              lang={introIsUrdu ? 'ur' : 'en'}
            >
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
              placeholder="I'm {{ownerName}}'s assistant — not {{ownerName}} the lawyer. I'll answer your messages and voice notes. Tell me how I can help."
            />
          </Field>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t('aiVoiceAssistantSection')}</p>
              <p className="text-xs text-muted-foreground">{t('aiVoiceAssistantSectionHint')}</p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 p-3">
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

            <Field
              label={t('aiAssistantVoiceGender')}
              hint={t('aiVoiceGenderHint')}
              error={form.formState.errors.aiVoiceGender?.message}
            >
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'female' as const, label: t('aiVoiceFemale') },
                  { value: 'male' as const, label: t('aiVoiceMale') },
                ]).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={voiceGender === opt.value ? 'default' : 'outline'}
                    onClick={() => setVoiceGender(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </Field>

            {(['ur', 'en'] as const).map((language) => (
              <VoicePicker
                key={language}
                language={language}
                label={language === 'ur' ? t('aiUrduVoice') : t('aiEnglishVoice')}
                hint={language === 'ur' ? t('aiUrduVoiceHint') : t('aiEnglishVoiceHint')}
                value={form.watch(voiceField(language))}
                onChange={(id) => form.setValue(voiceField(language), id, { shouldDirty: true })}
                voices={voicesForGender}
                defaultVoiceName={defaults?.[language][voiceGender].name}
                disabled={voices.isPending}
                previewing={previewVoice.isPending && previewVoice.variables?.language === language}
                previewDisabled={previewVoice.isPending || voices.isPending}
                onPreview={() => playPreview(language)}
              />
            ))}

            <Field label={t('aiToneLabel')} hint={t('aiToneHint')} error={form.formState.errors.aiTone?.message}>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'friendly' as const, label: t('aiToneFriendly') },
                  { value: 'formal' as const, label: t('aiToneFormal') },
                  { value: 'concise' as const, label: t('aiToneConcise') },
                ]).map((opt) => (
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

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('aiVoicePreviewHint')}</p>
              {previewUrl ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {playingLabel ?? t('aiVoicePreviewPlayer')}
                  </p>
                  <audio ref={playerRef} src={previewUrl} controls preload="auto" className="w-full max-w-md" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('aiVoicePreviewEmpty')}</p>
              )}
              {voices.data && !voices.data.configured ? (
                <p className="text-xs text-muted-foreground">{t('aiElevenLabsMissing')}</p>
              ) : null}
            </div>

            {form.watch('aiVoiceEnabled') ? (
              <Field
                label={t('aiVoiceReplyModeLabel')}
                hint={t('aiVoiceReplyModeAutoHint')}
                error={form.formState.errors.aiVoiceReplyMode?.message}
              >
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'auto' as const, label: t('aiVoiceReplyModeAuto') },
                    { value: 'voice_only' as const, label: t('aiVoiceReplyModeVoiceOnly') },
                    { value: 'text_only' as const, label: t('aiVoiceReplyModeTextOnly') },
                  ]).map((opt) => (
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

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t('aiLiveCallsSection')}</p>
              <p className="text-xs text-muted-foreground">{t('aiLiveCallsSectionHint')}</p>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('aiTakesCalls')}</Label>
                <p className="text-xs text-muted-foreground">{t('aiTakesCallsHint')}</p>
              </div>
              <Switch
                checked={form.watch('callsTakenBy') === 'ai'}
                onCheckedChange={(checked) => {
                  form.setValue('callsTakenBy', checked ? 'ai' : 'off', { shouldDirty: true });
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('aiCallHoursStart')}>
                <Input type="time" {...form.register('aiCallHoursStart')} />
              </Field>
              <Field label={t('aiCallHoursEnd')}>
                <Input type="time" {...form.register('aiCallHoursEnd')} />
              </Field>
              <Field label={t('aiCallHoursTimezone')} hint={t('aiCallHoursHint')}>
                <Input {...form.register('aiCallHoursTimezone')} placeholder="Asia/Karachi" />
              </Field>
            </div>
          </div>

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

/**
 * One reply language's voice: a picker grouped by what suits that language,
 * and a preview of exactly that voice. English and Urdu are chosen apart — the
 * voices that say Urdu sounds correctly are not the best English ones, and one
 * shared pick read Urdu with an English accent.
 */
function VoicePicker({
  language,
  label,
  hint,
  value,
  onChange,
  voices,
  defaultVoiceName,
  disabled,
  previewing,
  previewDisabled,
  onPreview,
}: {
  language: VoiceLanguage;
  label: string;
  hint: string;
  value: string;
  onChange: (voiceId: string) => void;
  voices: TtsVoice[];
  defaultVoiceName: string | undefined;
  disabled: boolean;
  previewing: boolean;
  previewDisabled: boolean;
  onPreview: () => void;
}) {
  const { t } = useLanguage();
  const recommended = voices.filter((voice) => voice.recommendedFor?.includes(language));
  const others = voices.filter((voice) => !voice.recommendedFor?.includes(language));
  const defaultLabel = t('aiDefaultVoiceNamed').replace('{name}', shortVoiceName(defaultVoiceName) || '…');
  const optionLabel = (voice: TtsVoice) => `${voice.name} · ${voice.accent}`;
  // The trigger shows labels, not raw values: without this map it showed the
  // word "default", or a 20-character voice id once one was picked.
  const items: Record<string, string> = { default: defaultLabel };
  for (const voice of voices) items[voice.id] = optionLabel(voice);
  if (value && !items[value]) items[value] = value;

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={items}
          value={value || 'default'}
          onValueChange={(next) => onChange(!next || next === 'default' ? '' : String(next))}
          disabled={disabled}
        >
          <SelectTrigger className="w-full max-w-md flex-1" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          {/* Voice names are long ("Anika – Empathetic E-commerce Support"); a
              popup pinned to the trigger's width cut them off on a phone. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-[min(28rem,calc(100vw-2rem))]">
            <SelectItem value="default">{defaultLabel}</SelectItem>
            {recommended.length > 0 ? (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>
                    {language === 'ur' ? t('aiVoiceGroupRecommendedUr') : t('aiVoiceGroupRecommendedEn')}
                  </SelectLabel>
                  {recommended.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {optionLabel(voice)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            ) : null}
            {others.length > 0 ? (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>{t('aiVoiceGroupOther')}</SelectLabel>
                  {others.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {optionLabel(voice)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            ) : null}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" disabled={previewDisabled} onClick={onPreview}>
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {t('aiPreviewVoice')}
        </Button>
      </div>
    </Field>
  );
}

/** "Anika – Empathetic E-commerce Support" → "Anika", for the compact default label. */
function shortVoiceName(name: string | undefined): string {
  return name?.split(/\s+[–—-]\s+/)[0]?.trim() ?? '';
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
