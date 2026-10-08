'use client';

import { DemoPage, useDemo } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Signal, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/workspace/panel';
import { formatPkr, type DemoPayment } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

export const methodLabel: Record<DemoPayment['method'], string> = {
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
  CARD_LOCAL: 'Card',
  CARD_INTL: 'Card (intl)',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  OTHER_MANUAL: 'Other',
};

function statusOf(p: DemoPayment): { level: SignalLevel; key: TranslationKey } {
  if (p.status === 'SUCCEEDED' || p.status === 'RECORDED_MANUAL') return { level: 'ok', key: 'payReceived' };
  if (p.status === 'PENDING') return { level: 'attention', key: 'payVerify' };
  if (p.overdue) return { level: 'critical', key: 'demoOverdue' };
  if (p.status === 'REQUESTED') return { level: 'routine', key: 'demoRequested' };
  return { level: 'info', key: 'payOther' };
}

export function PaymentsView() {
  const { t } = useLanguage();
  const { payments, verifyPayment } = useDemo();
  const sum = (f: (p: DemoPayment) => boolean) => payments.filter(f).reduce((a, p) => a + p.amountPkr, 0);
  const collected = sum((p) => p.status === 'SUCCEEDED' || p.status === 'RECORDED_MANUAL');
  const pending = sum((p) => p.status === 'PENDING');
  const overdue = sum((p) => p.status === 'REQUESTED' && Boolean(p.overdue));

  return (
    <DemoPage>
      <PageHeader eyebrow={`OCT 2026 · PKR`} title={t('payments')} description={t('demoPayLede')} />

      <dl className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3">
        {[
          [t('demoCollected'), collected, 'text-foreground', t('demoLast30')],
          [t('demoPending'), pending, 'text-attention', t('payProofsAwaiting')],
          [t('demoOverdue'), overdue, 'text-critical', t('payPast14')],
        ].map(([k, v, tone, hint]) => (
          <div key={String(k)} className="bg-card p-5">
            <dt className="docket text-muted-foreground">{k}</dt>
            <dd className={cn('mt-2 font-mono text-[1.75rem] font-medium leading-none tabular-nums tracking-tight', String(tone))}>{formatPkr(Number(v))}</dd>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </dl>

      <Panel title={t('payLedger')} meta={`${payments.length} ${t('payEntries')}`} bodyClassName="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-sunken/70">
            <tr>
              {[t('docAdded'), t('mfClient'), t('payDescription'), t('payMethod'), t('demoStatus')].map((h) => (
                <th key={h} scope="col" className="docket px-4 py-2 text-start font-medium text-muted-foreground">{h}</th>
              ))}
              <th scope="col" className="docket px-4 py-2 text-end font-medium text-muted-foreground">{t('payAmount')}</th>
              <th scope="col" className="w-28 px-4 py-2"><span className="sr-only">{t('payAction')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => {
              const s = statusOf(p);
              return (
                <tr key={p.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">{p.date}</td>
                  <td className="px-4 py-2.5">
                    <span className="block font-medium">{p.client}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.caseRef}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.description}</td>
                  <td className="px-4 py-2.5">{methodLabel[p.method]}</td>
                  <td className="px-4 py-2.5"><Signal level={s.level}>{t(s.key)}</Signal></td>
                  <td className="px-4 py-2.5 text-end font-mono font-medium tabular-nums">{p.amountPkr.toLocaleString('en-PK')}</td>
                  <td className="px-4 py-2.5 text-end">
                    {p.status === 'PENDING' ? (
                      <Button size="sm" className="h-7" onClick={() => verifyPayment(p.id)}>
                        {t('payVerifyAction')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={5} className="docket px-4 py-3 text-muted-foreground">{t('payTotalReceived')}</td>
              <td className="px-4 py-3 text-end font-mono font-semibold tabular-nums">{collected.toLocaleString('en-PK')}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Panel>
    </DemoPage>
  );
}
