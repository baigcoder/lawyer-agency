'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { CircleDollarSign, Clock, Receipt, Wallet, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricCard } from '@/components/metric-card';
import { PaymentReceivingDetailsCard } from '@/components/payment-receiving-details-card';
import { PageHeader } from '@/components/page-header';
import { apiRequest, ApiError } from '@/lib/api-client';
import { formatMoney, humanizeEnum } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import { clientFolderListSchema } from '@/lib/schemas/client';
import { caseListSchema } from '@/lib/schemas/case';
import { paymentListSchema, paymentMethodSchema, type PaymentDto } from '@/lib/schemas/payment';

const requestMethods = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'] as const;
const manualMethods = ['BANK_TRANSFER', 'CASH', 'OTHER_MANUAL'] as const;

const statusVariant: Record<PaymentDto['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  PENDING: 'outline',
  SUCCEEDED: 'default',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
  RECORDED_MANUAL: 'default',
  CANCELLED: 'outline',
};

const paymentFormSchema = z.object({
  clientId: z.string().uuid('Choose a client'),
  caseId: z.string().uuid().optional().or(z.literal('')),
  amountPkr: z.number().min(1, 'Amount must be at least 1 PKR'),
  currency: z.string().length(3, 'Currency must be 3 letters').toUpperCase(),
  method: paymentMethodSchema,
  description: z.string().max(500).optional(),
  returnUrl: z.string().url('Enter a valid return URL'),
  paidAt: z.string().optional(),
  tab: z.enum(['electronic', 'manual']),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

function paymentDate(p: PaymentDto): Date {
  return p.paidAt ?? p.requestedAt;
}

export default function PaymentsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      clientId: '',
      caseId: '',
      amountPkr: 0,
      currency: 'PKR',
      method: 'JAZZCASH',
      description: '',
      returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/dashboard/payments` : 'https://wakeel.local/dashboard/payments',
      paidAt: '',
      tab: 'electronic',
    },
  });

  const tab = useWatch({ control: form.control, name: 'tab' });

  const listQuery = useQuery({
    queryKey: ['payments'],
    queryFn: () => apiRequest('/v1/payments', { schema: paymentListSchema }),
  });

  const clientsQuery = useQuery({
    queryKey: ['payments', 'clients'],
    queryFn: () => apiRequest('/v1/documents/clients/list', { schema: clientFolderListSchema }),
  });

  const casesQuery = useQuery({
    queryKey: ['cases', 'all'],
    queryFn: () => apiRequest('/v1/cases?status=all', { schema: caseListSchema }),
  });

  const metrics = useMemo(() => {
    const rows = listQuery.data ?? [];
    const collected = rows
      .filter((p) => p.status === 'SUCCEEDED' || p.status === 'RECORDED_MANUAL')
      .reduce((sum, p) => sum + p.amountCents, 0);
    const pending = rows.filter((p) => p.status === 'PENDING' || p.status === 'REQUESTED').length;
    const failed = rows.filter((p) => p.status === 'FAILED').length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = rows
      .filter((p) => {
        if (p.status !== 'SUCCEEDED' && p.status !== 'RECORDED_MANUAL') return false;
        return paymentDate(p) >= monthStart;
      })
      .reduce((sum, p) => sum + p.amountCents, 0);
    return { collected, pending, failed, thisMonth };
  }, [listQuery.data]);

  const electronicMutation = useMutation<unknown, Error, PaymentFormValues>({
    mutationFn: (body) =>
      apiRequest('/v1/payments', {
        method: 'POST',
        body: {
          clientId: body.clientId,
          caseId: body.caseId || undefined,
          amountCents: Math.round(body.amountPkr * 100),
          currency: body.currency,
          method: body.method,
          description: body.description || undefined,
          returnUrl: body.returnUrl,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('paymentRequestCreated'));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('paymentRequestFailed'));
    },
  });

  const manualMutation = useMutation<unknown, Error, PaymentFormValues>({
    mutationFn: (body) =>
      apiRequest('/v1/payments/manual', {
        method: 'POST',
        body: {
          clientId: body.clientId,
          caseId: body.caseId || undefined,
          amountCents: Math.round(body.amountPkr * 100),
          currency: body.currency,
          method: body.method,
          description: body.description || undefined,
          paidAt: body.paidAt ? new Date(body.paidAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('manualPaymentRecorded'));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('manualPaymentFailed'));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/payments/${id}/received`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(t('paymentMarkedReceived'));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('paymentMarkFailed'));
    },
  });

  const refundMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/payments/${id}/refund`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('refundFailed'));
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const isManualMethod = manualMethods.includes(values.method as (typeof manualMethods)[number]);
    if (values.tab === 'manual') {
      if (!isManualMethod) {
        form.setError('method', { message: t('chooseManualMethod') });
        return;
      }
      if (!values.paidAt) {
        form.setError('paidAt', { message: t('paidAtRequired') });
        return;
      }
      manualMutation.mutate(values);
    } else {
      const isRequestMethod = requestMethods.includes(values.method as (typeof requestMethods)[number]);
      if (!isRequestMethod) {
        form.setError('method', { message: t('chooseElectronicMethod') });
        return;
      }
      electronicMutation.mutate(values);
    }
  });

  const methodsForTab = (tab === 'manual' ? manualMethods : requestMethods) as readonly PaymentDto['method'][];

  const setTab = (next: 'electronic' | 'manual') => {
    form.setValue('tab', next, { shouldValidate: false });
    const firstMethod = (next === 'manual' ? manualMethods[0] : requestMethods[0]);
    if (firstMethod) {
      form.setValue('method', firstMethod, { shouldValidate: false });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('payments')} description={t('paymentsDescription')} icon={Wallet} />

      <PaymentReceivingDetailsCard />

      <p className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t('pkPaymentGatewayHint')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('totalCollected')}
          value={formatMoney(metrics.collected)}
          icon={CircleDollarSign}
          accent
          isPending={listQuery.isPending}
        />
        <MetricCard
          title={t('pendingPayments')}
          value={String(metrics.pending)}
          icon={Clock}
          isPending={listQuery.isPending}
        />
        <MetricCard
          title={t('failedPayments')}
          value={String(metrics.failed)}
          icon={XCircle}
          isPending={listQuery.isPending}
        />
        <MetricCard
          title={t('thisMonthTotal')}
          value={formatMoney(metrics.thisMonth)}
          icon={Receipt}
          isPending={listQuery.isPending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recordOrRequestPayment')}</CardTitle>
          <CardDescription>{t('recordOrRequestPaymentDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('selectClient')} error={form.formState.errors.clientId?.message}>
                <Controller
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? '')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('chooseClient')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientsQuery.data ?? []).map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name ?? client.waPhone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label={t('selectCaseOptional')} error={form.formState.errors.caseId?.message}>
                <Controller
                  control={form.control}
                  name="caseId"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v ?? '')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('chooseCaseOptional')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('noCase')}</SelectItem>
                        {(casesQuery.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.reference} — {c.matterType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label={t('amountPkr')}
                hint={t('amountPkrHint')}
                error={form.formState.errors.amountPkr?.message}
              >
                <Input
                  type="number"
                  min={1}
                  step={1}
                  {...form.register('amountPkr', { valueAsNumber: true })}
                />
              </Field>
              <Field label={t('currency')} error={form.formState.errors.currency?.message}>
                <Input maxLength={3} {...form.register('currency')} />
              </Field>
              <Field label={t('paymentMethod')} error={form.formState.errors.method?.message}>
                <Controller
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? '')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {methodsForTab.map((m) => (
                          <SelectItem key={m} value={m}>
                            {humanizeEnum(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={tab === 'electronic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab('electronic')}
              >
                {t('electronic')}
              </Button>
              <Button
                type="button"
                variant={tab === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab('manual')}
              >
                {t('manualOffline')}
              </Button>
              {tab === 'manual' && (
                <span className="text-xs text-muted-foreground">
                  {t('paidAt')}
                </span>
              )}
            </div>

            {tab === 'manual' && (
              <Field label={t('paidAt')} error={form.formState.errors.paidAt?.message}>
                <Input type="datetime-local" {...form.register('paidAt')} />
              </Field>
            )}

            <Field label={t('description')} error={form.formState.errors.description?.message}>
              <Input {...form.register('description')} placeholder="Family consultation / completed meeting" />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={electronicMutation.isPending || manualMutation.isPending}>
                {tab === 'electronic' ? t('requestPayment') : t('recordPayment')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {tab === 'electronic'
                  ? 'Client gets your JazzCash, Easypaisa, or bank details on WhatsApp.'
                  : 'Manually record a payment already received.'}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isPending && (
            <div className="space-y-2" aria-busy="true" aria-label={t('loading')}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {listQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('couldNotLoadPayments')}: {listQuery.error.message}
            </p>
          )}

          {listQuery.isSuccess && listQuery.data.length === 0 && (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">{t('noPaymentsYet')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('noPaymentsYetDesc')}</p>
            </div>
          )}

          {listQuery.isSuccess && listQuery.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('amount')}</TableHead>
                  <TableHead>{t('client')}</TableHead>
                  <TableHead>{t('work')}</TableHead>
                  <TableHead>{t('method')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('case')}</TableHead>
                  <TableHead>{t('recordedBy')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {(row.amountCents / 100).toFixed(2)} {row.currency}
                    </TableCell>
                    <TableCell>{row.client?.name ?? row.client?.waPhone ?? '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {row.description ?? row.case?.matterType ?? '—'}
                    </TableCell>
                    <TableCell className="capitalize">{humanizeEnum(row.method)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.case?.reference ?? '—'}</TableCell>
                    <TableCell>{row.recordedByUser?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {(row.status === 'PENDING' || row.status === 'REQUESTED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={() => confirmMutation.mutate(row.id)}
                          disabled={confirmMutation.isPending}
                        >
                          {t('markReceived')}
                        </Button>
                      )}
                      {(row.status === 'SUCCEEDED' || row.status === 'RECORDED_MANUAL') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `${t('confirmRefund')} ${row.currency} ${(row.amountCents / 100).toFixed(2)}?`,
                              )
                            ) {
                              refundMutation.mutate(row.id);
                            }
                          }}
                          disabled={refundMutation.isPending}
                        >
                          {t('refund')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
