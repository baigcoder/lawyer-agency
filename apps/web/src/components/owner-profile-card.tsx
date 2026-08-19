'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Loader2, Plus, Trash2, UserCircle2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, ApiError } from '@/lib/api-client';
import {
  caseHighlightSchema,
  closedCaseOptionSchema,
  createCaseHighlightInputSchema,
  lawyerProfileInputSchema,
  lawyerProfileSchema,
  type LawyerProfileInput,
} from '@/lib/schemas/lawyer-profile';

const profileFormSchema = lawyerProfileInputSchema.extend({
  educationText: z.string().optional(),
  achievementsText: z.string().optional(),
  languagesText: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileFormSchema>;

function splitTags(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildAiPreview(data: ProfileForm): string {
  const lines: string[] = [];
  if (data.bio?.trim()) lines.push(`Bio: ${data.bio.trim()}`);
  if (data.bioUr?.trim()) lines.push(`Bio (Urdu): ${data.bioUr.trim()}`);
  if (data.yearsExperience != null) lines.push(`Experience: ${data.yearsExperience} years`);
  if (data.barCouncil?.trim()) lines.push(`Bar council: ${data.barCouncil.trim()}`);
  const education = splitTags(data.educationText);
  if (education.length) lines.push(`Education: ${education.join('; ')}`);
  const achievements = splitTags(data.achievementsText);
  if (achievements.length) lines.push(`Achievements: ${achievements.join('; ')}`);
  const languages = splitTags(data.languagesText);
  if (languages.length) lines.push(`Languages: ${languages.join(', ')}`);
  return lines.length ? lines.join('\n') : 'Complete your bio and experience so the AI can introduce you to clients.';
}

export function OwnerProfileCard() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['lawyer-profile', 'me'],
    queryFn: () => apiRequest('/v1/lawyers/me/profile', { schema: lawyerProfileSchema }),
    retry: false,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      bio: '',
      bioUr: '',
      yearsExperience: null,
      barCouncil: '',
      barEnrollmentNumber: '',
      educationText: '',
      achievementsText: '',
      languagesText: '',
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      bio: profile.data.bio,
      bioUr: profile.data.bioUr,
      yearsExperience: profile.data.yearsExperience,
      barCouncil: profile.data.barCouncil,
      barEnrollmentNumber: profile.data.barEnrollmentNumber,
      educationText: profile.data.education.join(', '),
      achievementsText: profile.data.achievements.join(', '),
      languagesText: profile.data.languages.join(', '),
    });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: (values: ProfileForm) => {
      const body: LawyerProfileInput = {
        bio: values.bio,
        bioUr: values.bioUr,
        yearsExperience: values.yearsExperience ?? null,
        barCouncil: values.barCouncil,
        barEnrollmentNumber: values.barEnrollmentNumber,
        education: splitTags(values.educationText),
        achievements: splitTags(values.achievementsText),
        languages: splitTags(values.languagesText),
      };
      return apiRequest('/v1/lawyers/me/profile', {
        method: 'PUT',
        body,
        schema: lawyerProfileSchema,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['lawyer-profile', 'me'], data);
      toast.success('Your profile was saved', { description: 'The AI can now cite your credentials to clients.' });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save your profile.');
    },
  });

  const watched = form.watch();
  const aiPreview = useMemo(() => buildAiPreview(watched), [watched]);
  const featuredPreview = profile.data?.caseHighlights.filter((h) => h.visibleToAi) ?? [];

  const onSubmit = form.handleSubmit((values) => save.mutate(values));

  if (profile.isPending) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading your profile…</span>
        </CardContent>
      </Card>
    );
  }

  if (profile.isError) {
    const message =
      profile.error instanceof ApiError
        ? profile.error.message
        : 'Could not load your profile.';
    return (
      <Card>
        <CardContent className="py-8">
          <p role="alert" className="text-sm text-destructive">
            {message}
            {profile.error instanceof ApiError && profile.error.status === 404
              ? ' The API may need a rebuild — run docker compose build api && docker compose up -d api migrate.'
              : null}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="h-4 w-4" /> Your profile
          </CardTitle>
          <CardDescription>
            Bio, bar membership, and achievements the AI may share with clients (T1-safe — no client PII).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio (English)</Label>
              <Textarea id="bio" rows={3} placeholder="Brief introduction for clients…" {...form.register('bio')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bioUr">Bio (Urdu)</Label>
              <Textarea id="bioUr" rows={3} placeholder="اردو میں تعارف…" dir="rtl" {...form.register('bioUr')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="yearsExperience">Years of experience</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  min={0}
                  max={70}
                  {...form.register('yearsExperience', {
                    setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barCouncil">Bar council</Label>
                <Input id="barCouncil" placeholder="Punjab Bar Council" {...form.register('barCouncil')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barEnrollmentNumber">Bar enrollment number (optional)</Label>
              <Input id="barEnrollmentNumber" {...form.register('barEnrollmentNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="educationText">Education (comma-separated)</Label>
              <Input id="educationText" placeholder="LLB Punjab University, LLM…" {...form.register('educationText')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="achievementsText">Achievements (comma-separated)</Label>
              <Input
                id="achievementsText"
                placeholder="Best lawyer award 2022, published in…"
                {...form.register('achievementsText')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="languagesText">Languages spoken (comma-separated)</Label>
              <Input id="languagesText" placeholder="English, Urdu, Punjabi" {...form.register('languagesText')} />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <CaseHighlightsSection highlights={profile.data?.caseHighlights ?? []} />

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> AI preview
          </CardTitle>
          <CardDescription>How the assistant may describe you when clients ask about experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-wrap font-medium">{profile.data?.name ?? 'You'}</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{aiPreview}</p>
          {featuredPreview.length > 0 ? (
            <div>
              <p className="mb-1 font-medium">Featured cases</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {featuredPreview.map((h) => (
                  <li key={h.id}>
                    {h.publicTitle}: {h.publicOutcome}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CaseHighlightsSection({ highlights }: { highlights: Array<{ id: string; caseReference: string; matterType: string; publicTitle: string; publicOutcome: string; visibleToAi: boolean }> }) {
  const queryClient = useQueryClient();
  const closedCases = useQuery({
    queryKey: ['lawyer-profile', 'closed-cases'],
    queryFn: () => apiRequest('/v1/lawyers/me/closed-cases', { schema: z.array(closedCaseOptionSchema) }),
  });

  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [publicTitle, setPublicTitle] = useState('');
  const [publicOutcome, setPublicOutcome] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [visibleToAi, setVisibleToAi] = useState(true);

  const createHighlight = useMutation({
    mutationFn: () => {
      const body = createCaseHighlightInputSchema.parse({
        caseId: selectedCaseId,
        publicTitle,
        publicOutcome,
        consentConfirmed: consentConfirmed ? true : undefined,
        visibleToAi,
      });
      return apiRequest('/v1/lawyers/me/case-highlights', {
        method: 'POST',
        body,
        schema: caseHighlightSchema,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-profile'] });
      setSelectedCaseId('');
      setPublicTitle('');
      setPublicOutcome('');
      setConsentConfirmed(false);
      toast.success('Case highlight added');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not add case highlight.');
    },
  });

  const deleteHighlight = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/lawyers/me/case-highlights/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-profile'] });
      toast.success('Case highlight removed');
    },
  });

  const toggleVisible = useMutation({
    mutationFn: ({ id, visibleToAi: visible }: { id: string; visibleToAi: boolean }) =>
      apiRequest(`/v1/lawyers/me/case-highlights/${id}`, {
        method: 'PUT',
        body: { visibleToAi: visible },
        schema: caseHighlightSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lawyer-profile'] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Featured closed cases</CardTitle>
        <CardDescription>
          Link anonymized outcomes from closed matters. Only T1 public title/outcome is shared with the AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {highlights.length > 0 ? (
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{h.publicTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.caseReference} · {h.matterType}
                    </p>
                    <p className="mt-1 text-muted-foreground">{h.publicOutcome}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={h.visibleToAi}
                      onCheckedChange={(checked) => toggleVisible.mutate({ id: h.id, visibleToAi: checked })}
                      aria-label="Visible to AI"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHighlight.mutate(h.id)}
                      aria-label="Remove highlight"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No featured cases yet.</p>
        )}

        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">Add a closed case</p>
          {closedCases.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Select value={selectedCaseId} onValueChange={(v) => setSelectedCaseId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a closed case…" />
                </SelectTrigger>
                <SelectContent>
                  {(closedCases.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.reference} — {c.matterType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Public title (anonymized)"
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
              />
              <Textarea
                placeholder="One-line outcome (no client names or PII)"
                rows={2}
                value={publicOutcome}
                onChange={(e) => setPublicOutcome(e.target.value)}
              />
              <div className="flex items-start gap-2">
                <Checkbox
                  id="consentConfirmed"
                  checked={consentConfirmed}
                  onCheckedChange={(v) => setConsentConfirmed(v === true)}
                />
                <Label htmlFor="consentConfirmed" className="text-xs leading-snug text-muted-foreground">
                  I confirm client consent or that this highlight is fully anonymized with no identifying details.
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={visibleToAi} onCheckedChange={setVisibleToAi} id="visibleToAi" />
                <Label htmlFor="visibleToAi" className="text-sm">Show to AI</Label>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!selectedCaseId || !publicTitle.trim() || !publicOutcome.trim() || !consentConfirmed || createHighlight.isPending}
                onClick={() => createHighlight.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" /> Add highlight
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
