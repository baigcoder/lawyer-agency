'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, ApiError } from '@/lib/api-client';
import { firmProfileSchema, type FirmProfile } from '@/lib/schemas/firm-profile';

const firmSettingsSchema = firmProfileSchema.extend({
  consultationFeePkr: z.number().int('Whole rupees only').min(0, 'No negative fees'),
});
export type FirmSettings = z.infer<typeof firmSettingsSchema>;

export function FirmProfileForm() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['firm-profile'], queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileSchema }) });

  const form = useForm<FirmSettings>({
    resolver: zodResolver(firmSettingsSchema),
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
      consultationFeePkr: 3000,
      firmAbout: '',
      foundingYear: null,
      differentiators: [],
    },
  });

  useEffect(() => {
    if (profile.data) form.reset(profile.data);
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: (body: FirmSettings) => {
      const payload: FirmProfile = {
        firmName: body.firmName,
        displayName: body.displayName,
        city: body.city,
        officeAddress: body.officeAddress,
        website: body.website,
        practiceAreas: body.practiceAreas,
        clientLanguages: body.clientLanguages,
        officeHours: body.officeHours,
        teamSize: body.teamSize,
        consultationFeePkr: body.consultationFeePkr,
        firmAbout: body.firmAbout,
        foundingYear: body.foundingYear ?? null,
        differentiators: body.differentiators ?? [],
      };
      return apiRequest('/v1/firm-profile', { method: 'PUT', body: payload, schema: firmProfileSchema });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['firm-profile'], data);
      toast.success('Firm profile saved', { description: 'Changes are live for intake and templates.' });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save your firm profile.');
    },
  });

  const onSubmit = form.handleSubmit((values) => save.mutate(values));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Firm profile</CardTitle>
        <CardDescription>Used for intake behavior, templates, and billing defaults.</CardDescription>
      </CardHeader>
      <CardContent>
        {profile.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="firmName">Firm name</Label>
              <Input id="firmName" autoComplete="organization" {...form.register('firmName')} />
              {form.formState.errors.firmName && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.firmName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...form.register('displayName')} />
              {form.formState.errors.displayName && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" autoComplete="address-level2" {...form.register('city')} />
              {form.formState.errors.city && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.city.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="officeAddress">Office address</Label>
              <Input id="officeAddress" autoComplete="street-address" {...form.register('officeAddress')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" inputMode="url" {...form.register('website')} />
              {form.formState.errors.website && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.website.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="teamSize">Team size</Label>
                <Input id="teamSize" type="number" min={1} {...form.register('teamSize', { valueAsNumber: true })} />
                {form.formState.errors.teamSize && (
                  <p className="text-sm text-destructive" role="alert">{form.formState.errors.teamSize.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="consultationFeePkr">Consultation fee (PKR)</Label>
                <Input
                  id="consultationFeePkr"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...form.register('consultationFeePkr', { valueAsNumber: true })}
                />
                {form.formState.errors.consultationFeePkr && (
                  <p className="text-sm text-destructive" role="alert">{form.formState.errors.consultationFeePkr.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="practiceAreas">Practice areas (comma-separated)</Label>
              <Controller
                control={form.control}
                name="practiceAreas"
                render={({ field }) => (
                  <Input
                    id="practiceAreas"
                    placeholder="Family Law, Criminal Defence, Property"
                    value={field.value.join(', ')}
                    onChange={(e) => field.onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  />
                )}
              />
              {form.formState.errors.practiceAreas && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.practiceAreas.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="officeHours">Office hours</Label>
              <Input id="officeHours" {...form.register('officeHours')} />
              {form.formState.errors.officeHours && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.officeHours.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="firmAbout">About the firm (optional)</Label>
              <Textarea
                id="firmAbout"
                rows={3}
                placeholder="Brief description for AI and client conversations…"
                {...form.register('firmAbout')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="foundingYear">Founding year (optional)</Label>
                <Input
                  id="foundingYear"
                  type="number"
                  min={1900}
                  max={2100}
                  {...form.register('foundingYear', {
                    setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="differentiators">Differentiators (comma-separated)</Label>
                <Controller
                  control={form.control}
                  name="differentiators"
                  render={({ field }) => (
                    <Input
                      id="differentiators"
                      placeholder="Urdu-first intake, 24h response…"
                      value={(field.value ?? []).join(', ')}
                      onChange={(e) => field.onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                    />
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save settings
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
