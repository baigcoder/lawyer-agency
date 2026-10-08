'use client';

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Signal, type SignalLevel } from '@/components/signal';
import { factLabel } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import type { HandoffBrief } from '@/lib/schemas/escalations';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const docStatus: Record<string, { key: TranslationKey; level: SignalLevel }> = {
  PENDING: { key: 'mfRequested', level: 'attention' },
  REQUESTED: { key: 'mfRequested', level: 'attention' },
  FULFILLED: { key: 'briefReceived', level: 'ok' },
  RECEIVED: { key: 'briefReceived', level: 'ok' },
  VERIFIED: { key: 'briefVerified', level: 'ok' },
  CANCELLED: { key: 'briefCancelled', level: 'info' },
};

function Block({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-border pt-3', className)}>
      <h4 className="docket mb-2 text-muted-foreground">{label}</h4>
      {children}
    </section>
  );
}

/**
 * Lawyer handoff brief, laid out as a dossier: hairline-separated sections
 * rather than nested boxes. Works from a 320px side panel (inbox context
 * pane) up to the wide escalation view via a container query.
 */
export function HandoffBriefView({
  reason,
  excerpt,
  brief,
}: {
  reason: string | null;
  excerpt: string | null;
  brief: HandoffBrief;
}) {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const factEntries = Object.entries(brief.facts ?? {});
  const requests = brief.documents?.requests ?? [];
  const files = brief.documents?.files ?? [];
  const situation = brief.situation?.trim();

  return (
    <div className="@container space-y-4 text-[13px] leading-relaxed">
      {situation ? (
        <section>
          <h4 className="docket mb-1.5 text-muted-foreground">{t('briefSituation')}</h4>
          <p className="text-sm leading-6 text-foreground">{situation}</p>
        </section>
      ) : null}

      {brief.matterType || reason ? (
        <dl className="grid gap-3 border-t border-border pt-3 @md:grid-cols-2">
          {brief.matterType ? (
            <div>
              <dt className="docket text-muted-foreground">{t('briefMatterType')}</dt>
              <dd className="mt-1 font-medium">{brief.matterType}</dd>
            </div>
          ) : null}
          {reason ? (
            <div>
              <dt>
                <Signal level="critical">{t('briefTrigger')}</Signal>
              </dt>
              <dd className="mt-1 font-medium text-critical">{reason}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {excerpt ? (
        <Block label={t('briefExcerpt')}>
          <blockquote dir="auto" className="border-s-2 border-attention ps-3 text-foreground/90">
            “{excerpt}”
          </blockquote>
        </Block>
      ) : null}

      {factEntries.length > 0 ? (
        <Block label={t('briefFacts')}>
          <dl className="grid gap-x-6 @md:grid-cols-2">
            {factEntries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 border-b border-dashed border-border py-1.5">
                <dt className="truncate text-muted-foreground">{factLabel(key)}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Block>
      ) : null}

      {requests.length > 0 || files.length > 0 ? (
        <Block label={t('documents')}>
          <ul className="space-y-1.5">
            {requests.map((row) => {
              const status = docStatus[row.status];
              return (
                <li key={`${row.description}-${row.status}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{row.description}</span>
                  <Signal level={status?.level ?? 'info'} className={urdu}>
                    {status ? t(status.key) : row.status}
                  </Signal>
                </li>
              );
            })}
            {files.map((row) => (
              <li key={`${row.filename}-${row.docType}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{row.filename}</span>
                <span className="docket text-muted-foreground">{row.docType}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {brief.openItems.length > 0 ? (
        <Block label={t('briefOpen')}>
          <ol className="list-inside list-decimal space-y-1 marker:font-mono marker:text-muted-foreground">
            {brief.openItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </Block>
      ) : null}

      {brief.nextAction ? (
        <section className="flex gap-3 rounded-lg bg-primary/[0.06] p-3 ring-1 ring-primary/20">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />
          <div>
            <h4 className="docket text-primary">{t('briefNext')}</h4>
            <p className="mt-1 font-medium">{brief.nextAction}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
