'use client';

import Link from 'next/link';
import { CreateOrganization, useAuth, useOrganization, useOrganizationList } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/env';
import { practiceAreaOptions } from '@/lib/schemas/firm-profile';

const wizardSchema = z.object({
  firmName: z.string().trim().min(2, 'Enter the firm legal name').max(120),
  displayName: z.string().trim().min(2, 'Enter a display name').max(120),
  city: z.string().trim().min(2, 'City is required').max(60),
  officeAddress: z.string().trim().max(200).optional(),
  website: z.union([z.string().trim().url('Enter a valid URL').max(200), z.literal('')]).optional(),
  practiceAreas: z.array(z.string()).min(1, 'Choose at least one practice area'),
  clientLanguages: z.array(z.enum(['EN', 'UR', 'ROMAN_URDU'])).min(1, 'Choose at least one language'),
  officeHours: z.string().trim().min(2).max(120),
  teamSize: z.number().int({ message: 'Enter a whole number of team members' }).min(1).max(5000),
  adminName: z.string().trim().min(1, 'Your name is required').max(120),
  adminEmail: z.union([z.string().trim().email('Enter a valid email').max(200), z.literal('')]).optional(),
});

type WizardValues = z.infer<typeof wizardSchema>;

const STEPS = ['Firm details', 'Practice areas', 'Languages & hours', 'Admin & review'] as const;

export default function OnboardingPage() {
  if (!clerkEnabled) return <main id="main" className="flex min-h-screen items-center justify-center p-4"><Card className="max-w-md"><CardHeader><CardTitle>Development onboarding</CardTitle><CardDescription>The configured development tenant is already available.</CardDescription></CardHeader><CardContent><Button nativeButton={false} render={<Link href="/dashboard/setup" />}>Continue to setup</Button></CardContent></Card></main>;
  return <ClerkOnboarding />;
}

function ClerkOnboarding() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { isLoaded: listLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const existingOrgId = userMemberships.data?.[0]?.organization.id;

  useEffect(() => {
    if (!listLoaded || organization || !existingOrgId) return;
    void setActive({ organization: existingOrgId });
  }, [existingOrgId, listLoaded, organization, setActive]);

  if (!orgLoaded || !listLoaded || userMemberships.isLoading) {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!organization && existingOrgId) {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!organization) {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Create your firm
            </CardTitle>
            <CardDescription>
              One owner creates one firm. After this, invite lawyers from Team — do not create another organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganization skipInvitationScreen afterCreateOrganizationUrl="/onboarding" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return <ProvisionWizard />;
}

function ProvisionWizard() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      firmName: '',
      displayName: '',
      city: '',
      officeAddress: '',
      website: '',
      practiceAreas: [],
      clientLanguages: ['EN', 'UR'],
      officeHours: 'Mon–Sat, 9:00–18:00 PKT',
      teamSize: 1,
      adminName: '',
      adminEmail: '',
    },
    mode: 'onTouched',
  });
  const selectedAreas = useWatch({ control: form.control, name: 'practiceAreas' }) ?? [];
  const selectedLanguages = useWatch({ control: form.control, name: 'clientLanguages' }) ?? [];
  const wizardFirmName = useWatch({ control: form.control, name: 'firmName' });

  const provision = useMutation({
    mutationFn: async (values: WizardValues) => apiRequest('/v1/firm-provisioning', { method: 'PUT', token: await getToken(), body: values }),
    onSuccess: () => { router.push('/dashboard/setup?step=whatsapp'); },
  });

  const next = async () => {
    const fields = (() => {
      switch (step) {
        case 0: return ['firmName', 'displayName', 'city', 'officeAddress', 'website', 'teamSize'] as const;
        case 1: return ['practiceAreas'] as const;
        case 2: return ['clientLanguages', 'officeHours'] as const;
        default: return [] as const;
      }
    })();
    const valid = await form.trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = form.handleSubmit((values) => provision.mutate(values));
  // Enter on a non-final step must advance the step, not submit the whole wizard —
  // otherwise it validates unmounted later-step fields and fails silently. On the
  // final step Enter submits as normal.
  const onSubmitStep = (e: FormEvent) => {
    if (step < STEPS.length - 1) {
      e.preventDefault();
      void next();
      return;
    }
    void submit(e);
  };

  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">Set up your firm</CardTitle>
          <CardDescription aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</CardDescription>
          <div className="flex gap-1.5 pt-2" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Onboarding progress">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
                aria-current={i === step ? 'step' : undefined}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmitStep} noValidate className="space-y-4">
            {step === 0 ? (
              <>
                <Field label="Firm legal name" hint="As registered with SECP/FBR" error={form.formState.errors.firmName?.message}><Input {...form.register('firmName')} placeholder="ABC Law Associates (Pvt) Ltd" /></Field>
                <Field label="Display name" hint="What clients see in WhatsApp messages" error={form.formState.errors.displayName?.message}><Input {...form.register('displayName')} placeholder="ABC Law Associates" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" error={form.formState.errors.city?.message}><Input {...form.register('city')} placeholder="Lahore" /></Field>
                  <Field label="Team size" error={form.formState.errors.teamSize?.message}><Input type="number" min={1} {...form.register('teamSize', { valueAsNumber: true })} /></Field>
                </div>
                <Field label="Office address" error={form.formState.errors.officeAddress?.message}><Input {...form.register('officeAddress')} placeholder="1 Mall Road, GOR-1" /></Field>
                <Field label="Website" error={form.formState.errors.website?.message}><Input {...form.register('website')} placeholder="https://abclaw.pk" /></Field>
              </>
            ) : null}
            {step === 1 ? (
              <Field label="Practice areas" hint="Pick all that apply" error={form.formState.errors.practiceAreas?.message}>
                <PracticeAreaPicker
                  selected={selectedAreas}
                  onToggle={(area) => {
                    const current = selectedAreas;
                    form.setValue('practiceAreas', current.includes(area) ? current.filter((a) => a !== area) : [...current, area], { shouldValidate: true });
                  }}
                />
              </Field>
            ) : null}
            {step === 2 ? (
              <>
                <Field label="Client languages" hint="The AI answers in these languages" error={form.formState.errors.clientLanguages?.message}>
                  <LanguagePicker
                    selected={selectedLanguages}
                    onToggle={(lang) => {
                      const current = selectedLanguages;
                      form.setValue('clientLanguages', current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang], { shouldValidate: true });
                    }}
                  />
                </Field>
                <Field label="Office hours" error={form.formState.errors.officeHours?.message}><Input {...form.register('officeHours')} /></Field>
              </>
            ) : null}
            {step === 3 ? (
              <>
                <Field label="Your name" error={form.formState.errors.adminName?.message}><Input {...form.register('adminName')} placeholder="Sara Ahmed" /></Field>
                <Field label="Work email" hint="Optional — used for billing and alerts" error={form.formState.errors.adminEmail?.message}><Input type="email" {...form.register('adminEmail')} placeholder="sara@abclaw.pk" /></Field>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Wakeel will create a secure, tenant-isolated workspace for <span className="font-medium text-foreground">{wizardFirmName}</span> with you as administrator. You can complete the WhatsApp connection next — pilot testing is available before the official Meta setup.
                </div>
              </>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => void next()}><ChevronRight className="ml-1 h-4 w-4" /> Continue</Button>
              ) : (
                <Button type="submit" disabled={provision.isPending}>{provision.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create workspace</Button>
              )}
            </div>
            {provision.isError ? <p role="alert" className="text-sm text-destructive">Couldn&apos;t create the firm workspace. Confirm that this organization is selected, then retry.</p> : null}
          </form>
        </CardContent>
      </Card>
    </main>
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
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}
          >
            {active ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 rounded-sm border border-border" />}
            {area}
          </button>
        );
      })}
    </div>
  );
}

function LanguagePicker({ selected, onToggle }: { selected: Array<'EN' | 'UR' | 'ROMAN_URDU'>; onToggle: (lang: 'EN' | 'UR' | 'ROMAN_URDU') => void }) {
  const labels = { EN: 'English', UR: 'Urdu', ROMAN_URDU: 'Roman Urdu' } as const;
  return (
    <div className="flex flex-wrap gap-2">
      {(['EN', 'UR', 'ROMAN_URDU'] as const).map((lang) => {
        const active = selected.includes(lang);
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(lang)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}
          >
            {active ? <Check className="h-4 w-4" /> : null}
            {labels[lang]}
          </button>
        );
      })}
     </div>
  );
}

