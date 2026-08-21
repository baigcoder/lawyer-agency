'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircleMore,
  Rocket,
  Smartphone,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappConnectionCard } from '@/components/whatsapp-connection-card';
import { OwnerProfileCard } from '@/components/owner-profile-card';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';
import { firmProfileSchema } from '@/lib/schemas/firm-profile';
import { practiceAreaOptions } from '@/lib/schemas/firm-profile';
import type { FirmProfile } from '@/lib/schemas/firm-profile';
import {
  evolutionConnectionStatusSchema,
  pilotTestInboundResponseSchema,
  pilotTestInboundSchema,
} from '@/lib/schemas/whatsapp';
import { inboxDetailSchema } from '@/lib/schemas/inbox';
import { roleListSchema, userListSchema, inviteUserResultSchema, inviteUserSchema } from '@/lib/schemas/users';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEPS = [
  { key: 'profile', label: 'Firm profile', icon: Building2, description: 'Name, city, practice areas' },
  { key: 'team', label: 'Team', icon: Users, description: 'Invite lawyers & staff' },
  { key: 'whatsapp', label: 'Connect WhatsApp', icon: Smartphone, description: 'QR or official number' },
  { key: 'test', label: 'Test your AI', icon: MessageCircleMore, description: 'Send a test message' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupPageSkeleton />}>
      <SetupContent />
    </Suspense>
  );
}

function SetupPageSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t('setup')} description={t('setupDescription')} icon={Rocket} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {STEPS.map((s) => (
            <Skeleton key={s.key} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

function SetupContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialStep = (searchParams.get('step') as StepKey) ?? 'profile';
  const [step, setStep] = useState<StepKey>(STEPS.some((s) => s.key === initialStep) ? initialStep : 'profile');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t('setup')} description={t('setupDescription')} icon={Rocket} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Vertical stepper sidebar */}
        <Stepper step={step} onStepClick={setStep} />

        {/* Step content */}
        <div className="min-w-0">
          {step === 'profile' && (
            <div className="space-y-6">
              <ProfileStep onNext={() => setStep('team')} />
              <OwnerProfileCard />
            </div>
          )}
          {step === 'team' && (
            <TeamStep onNext={() => setStep('whatsapp')} onBack={() => setStep('profile')} />
          )}
          {step === 'whatsapp' && (
            <WhatsappStep onNext={() => setStep('test')} onBack={() => setStep('team')} />
          )}
          {step === 'test' && <TestStep onBack={() => setStep('whatsapp')} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step, onStepClick }: { step: StepKey; onStepClick: (s: StepKey) => void }) {
  const index = STEPS.findIndex((s) => s.key === step);
  const progress = ((index) / (STEPS.length - 1)) * 100;

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar */}
      <div className="mb-2 rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Progress</span>
          <span className="font-semibold text-primary">{index + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < index;
        const current = i === index;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onStepClick(s.key)}
            className={cn(
              'group flex items-center gap-3 rounded-xl border p-3 text-start transition-all',
              current
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : done
                  ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'border-border bg-card hover:bg-accent/60',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
                current
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                'text-sm font-medium',
                current ? 'text-primary' : done ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
              )}>
                {s.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">{s.description}</p>
            </div>
            {current && (
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProfileStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileSchema }),
  });
  const form = useForm<FirmProfile>({
    resolver: zodResolver(firmProfileSchema),
    defaultValues: {
      firmName: '',
      displayName: '',
      city: '',
      officeAddress: '',
      website: '',
      practiceAreas: [],
      clientLanguages: ['EN', 'UR', 'ROMAN_URDU'],
      officeHours: 'Mon–Sat, 9:00–18:00 PKT',
      teamSize: 1,
      consultationFeePkr: 0,
    },
  });

  useEffect(() => {
    if (profile.data) form.reset(profile.data);
  }, [form, profile.data]);

  const save = useMutation({
    mutationFn: (body: FirmProfile) => apiRequest('/v1/firm-profile', { method: 'PUT', body, schema: firmProfileSchema }),
    onSuccess: (data) => {
      queryClient.setQueryData(['firm-profile'], data);
      form.reset(data);
      onNext();
    },
  });

  const submit = form.handleSubmit((values) => save.mutate(values));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review your firm profile</CardTitle>
        <CardDescription>This information powers the AI intake and client replies.</CardDescription>
      </CardHeader>
      <CardContent>
        {profile.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <form className="space-y-4" onSubmit={submit} noValidate>
            <Field label="Firm name" error={form.formState.errors.firmName?.message}>
              <Input {...form.register('firmName')} />
            </Field>
            <Field label="Display name" error={form.formState.errors.displayName?.message}>
              <Input {...form.register('displayName')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" error={form.formState.errors.city?.message}>
                <Input {...form.register('city')} />
              </Field>
              <Field label="Team size" error={form.formState.errors.teamSize?.message}>
                <Input type="number" min={1} {...form.register('teamSize', { valueAsNumber: true })} />
              </Field>
            </div>
            <Field label="Office address" error={form.formState.errors.officeAddress?.message}>
              <Input {...form.register('officeAddress')} />
            </Field>
            <Field label="Website" error={form.formState.errors.website?.message}>
              <Input {...form.register('website')} />
            </Field>
            <Field label="Practice areas" error={form.formState.errors.practiceAreas?.message}>
              <Controller
                control={form.control}
                name="practiceAreas"
                render={({ field }) => (
                  <PracticeAreaPicker selected={field.value} onToggle={(area) => {
                    const current = field.value;
                    field.onChange(current.includes(area) ? current.filter((a) => a !== area) : [...current, area]);
                  }} />
                )}
              />
            </Field>
            <Field label="Office hours" error={form.formState.errors.officeHours?.message}>
              <Input {...form.register('officeHours')} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & continue
              </Button>
            </div>
            {save.isError ? <p role="alert" className="text-sm text-destructive">Couldn&apos;t save your firm profile.</p> : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function PracticeAreaPicker({ selected, onToggle }: { selected: string[]; onToggle: (area: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {practiceAreaOptions.map((area) => {
        const active = selected.includes(area);
        return (
          <button
            key={area}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(area)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {active ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 rounded-sm border border-border" />}
            {area}
          </button>
        );
      })}
    </div>
  );
}

function TeamStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => apiRequest('/v1/users/roles/list', { schema: roleListSchema }),
  });
  const users = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => apiRequest('/v1/users?limit=100', { schema: userListSchema }),
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  const lawyerRoleId = roles.data?.find((r) => r.name === 'Lawyer')?.id ?? '';

  const invite = useMutation({
    mutationFn: (body: z.infer<typeof inviteUserSchema>) =>
      apiRequest('/v1/users', { method: 'POST', body, schema: inviteUserResultSchema }),
    onSuccess: () => {
      toast.success('Invitation sent. Clerk will email them to join this firm.');
      setName('');
      setEmail('');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not invite member.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleInvite = () => {
    const selectedRole = roleId || lawyerRoleId;
    if (!selectedRole || !name.trim() || !email.trim()) return;
    invite.mutate({
      name: name.trim(),
      email: email.trim(),
      roleId: selectedRole,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add your team (optional)</CardTitle>
        <CardDescription>
          Invite junior lawyers or staff who will handle escalated conversations. You can also do this later from Team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="setup-invite-name">Name</Label>
            <Input id="setup-invite-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="setup-invite-email">Email</Label>
            <Input id="setup-invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Role</Label>
            <Select value={roleId || lawyerRoleId} onValueChange={(v) => v && setRoleId(v)} disabled={roles.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Lawyer" />
              </SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleInvite} disabled={invite.isPending || !name.trim() || !email.trim()}>
          {invite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Invite team member
        </Button>

        {users.data && users.data.length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Current team ({users.data.length})</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {users.data.slice(0, 5).map((u) => (
                <li key={u.id}>{u.name} · {u.roleName} · {u.status.toLowerCase()}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Upload pinned documents from{' '}
          <Link href="/dashboard/documents" className="underline">Documents</Link>
          {' '}so the AI can reference them in client replies.
        </p>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button type="button" onClick={onNext}>
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WhatsappStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 text-sm">
          <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">Connect WhatsApp via Evolution</p>
            <p className="mt-1 text-muted-foreground">
              Choose QR (free, uses your phone) or Official (Meta-verified business number).
              Wakeel handles everything through one simple connection.
            </p>
          </div>
        </CardContent>
      </Card>

      <WhatsappConnectionCard />

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button type="button" onClick={onNext}>
          Continue <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TestStep({ onBack }: { onBack: () => void }) {
  const profile = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileSchema }),
  });
  const profileComplete = Boolean(
    profile.data?.displayName &&
      profile.data?.city &&
      profile.data?.practiceAreas.length > 0,
  );

  const [testNumber, setTestNumber] = useState('');
  const [testBody, setTestBody] = useState('Hello, I need legal help');
  const [conversationId, setConversationId] = useState<string | null>(null);

  const connection = useQuery({
    queryKey: ['whatsapp-connection'],
    queryFn: () => apiRequest('/v1/whatsapp/connection', { schema: evolutionConnectionStatusSchema }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'connecting' ? 2_000 : 10_000),
  });

  const sendTest = useMutation({
    mutationFn: async (values: z.infer<typeof pilotTestInboundSchema>) =>
      apiRequest('/v1/whatsapp/connection/test-inbound', {
        method: 'POST',
        body: values,
        schema: pilotTestInboundResponseSchema,
      }),
    onSuccess: (data) => setConversationId(data.conversationId),
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not send test message.');
    },
  });

  const isConnected = connection.data?.status === 'connected';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Test your AI
        </CardTitle>
        <CardDescription>
          Send a pretend client message and watch the AI reply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!profileComplete && !profile.isPending ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-medium">Complete your firm profile first</p>
            <p className="mt-1 text-muted-foreground">
              The AI uses your firm name, city, and practice areas to reply as your firm. Go back to the profile step and fill them in.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onBack}>
              Back to firm profile
            </Button>
          </div>
        ) : null}

        {connection.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connection status…
          </div>
        ) : !isConnected ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-medium">WhatsApp is not connected yet</p>
            <p className="mt-1 text-muted-foreground">Go back and connect WhatsApp before testing.</p>
          </div>
        ) : null}

        <div className="space-y-3">
          <Field label="Test phone number" hint="Any number you want to simulate">
            <Input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="923001234567"
              disabled={!isConnected || !profileComplete}
            />
          </Field>
          <Field label="Test message">
            <Input
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder="Hello, I need legal help"
              disabled={!isConnected || !profileComplete}
            />
          </Field>
          <Button
            type="button"
            onClick={() => void sendTest.mutate({ fromWaPhone: testNumber, body: testBody })}
            disabled={sendTest.isPending || !isConnected || !profileComplete || !testNumber}
          >
            {sendTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircleMore className="mr-2 h-4 w-4" />}
            Send test message to AI
          </Button>
        </div>

        {conversationId ? (
          <TestConversationPreview conversationId={conversationId} />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <MessageCircleMore className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Send a test message above to see the AI reply here.
          </div>
        )}

        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">Want to test on your phone instead?</p>
          <p className="mt-1 text-muted-foreground">
            Message your connected WhatsApp number from any phone. The AI will reply there too.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Open dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TestConversationPreview({ conversationId }: { conversationId: string }) {
  const [timedOutId, setTimedOutId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['inbox', conversationId],
    queryFn: () => apiRequest(`/v1/inbox/${conversationId}`, { schema: inboxDetailSchema }),
    refetchInterval: 2000,
  });

  const hasOutbound = detail.data?.messages.some((m) => m.direction === 'OUTBOUND') ?? false;
  const waitTimedOut = timedOutId === conversationId;

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOutId(conversationId), 20_000);
    return () => window.clearTimeout(timer);
  }, [conversationId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Live preview</p>
        {detail.isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {detail.isPending ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Loading conversation…</div>
      ) : detail.isError ? (
        <div className="rounded-lg border bg-destructive/5 p-4 text-sm text-destructive">Couldn&apos;t load the conversation preview.</div>
      ) : detail.data.messages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Waiting for the AI reply…
        </div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
          {detail.data.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.direction === 'INBOUND'
                    ? 'bg-muted text-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <p>{message.body ?? <span className="italic opacity-70">No text</span>}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {message.senderType === 'CLIENT' ? 'You (test)' : message.senderType.toLowerCase()} ·{' '}
                  {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {waitTimedOut && !hasOutbound && !detail.isPending ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">AI reply did not reach WhatsApp</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The AI processed your test message but could not deliver it to the phone. Go back, disconnect and reconnect WhatsApp, then try again.
          </p>
        </div>
      ) : null}
    </div>
  );
}
