'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, CreditCard, Loader2, Save, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { paymentDetailsSchema, type PaymentDetails } from '@/lib/schemas/payment-details';

const EMPTY: PaymentDetails = {
  jazzcashNumber: '',
  easypaisaNumber: '',
  bankName: '',
  accountTitle: '',
  accountNumber: '',
  iban: '',
};

export function PaymentReceivingDetailsCard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PaymentDetails>(EMPTY);
  const [justSaved, setJustSaved] = useState(false);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);

  const detailsQuery = useQuery({
    queryKey: ['payment-details'],
    queryFn: () => apiRequest('/v1/firm-profile/payment-details', { schema: paymentDetailsSchema }),
  });

  // Sync fetched data into form state once, keyed by the data object identity.
  if (detailsQuery.data && loadedFor !== detailsQuery.data) {
    setLoadedFor(detailsQuery.data);
    setForm({ ...EMPTY, ...detailsQuery.data });
  }

  const saveMutation = useMutation({
    mutationFn: (body: PaymentDetails) =>
      apiRequest('/v1/firm-profile/payment-details', {
        method: 'PUT',
        body,
        schema: paymentDetailsSchema,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['payment-details'], data);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      toast.success(t('paymentDetailsSaved'));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('paymentDetailsInvalid'));
    },
  });

  const update = (key: keyof PaymentDetails, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const parsed = paymentDetailsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(t('paymentDetailsInvalid'));
      return;
    }
    saveMutation.mutate(parsed.data);
  };

  if (detailsQuery.isPending) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">{t('loading')}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" aria-hidden />
          {t('paymentReceivingDetails')}
        </CardTitle>
        <CardDescription>{t('paymentReceivingDetailsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <span>Clients will receive these details in WhatsApp payment requests.</span>
          {justSaved && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('jazzcashNumber')}>
            <Input
              value={form.jazzcashNumber ?? ''}
              onChange={(e) => update('jazzcashNumber', e.target.value)}
              placeholder="03001234567"
              inputMode="tel"
            />
          </Field>
          <Field label={t('easypaisaNumber')}>
            <Input
              value={form.easypaisaNumber ?? ''}
              onChange={(e) => update('easypaisaNumber', e.target.value)}
              placeholder="03001234567"
              inputMode="tel"
            />
          </Field>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-primary" aria-hidden />
            {t('bankTransferDetails')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('bankName')}>
              <Input value={form.bankName ?? ''} onChange={(e) => update('bankName', e.target.value)} placeholder="HBL, Meezan, etc." />
            </Field>
            <Field label={t('accountTitle')}>
              <Input value={form.accountTitle ?? ''} onChange={(e) => update('accountTitle', e.target.value)} />
            </Field>
            <Field label={t('accountNumber')}>
              <Input value={form.accountNumber ?? ''} onChange={(e) => update('accountNumber', e.target.value)} />
            </Field>
            <Field label={t('iban')}>
              <Input value={form.iban ?? ''} onChange={(e) => update('iban', e.target.value)} placeholder="PK00XXXX..." />
            </Field>
          </div>
        </div>

        <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" aria-hidden />
          {saveMutation.isPending ? t('loading') : t('savePaymentDetails')}
        </Button>
      </CardContent>
    </Card>
  );
}
