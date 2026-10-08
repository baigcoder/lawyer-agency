'use client';

import { useEffect, useState } from 'react';
import { FileImage, FileText, Lock, Upload } from 'lucide-react';
import { DemoPage, useDemo } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Meter, Panel } from '@/components/workspace/panel';
import { DOCUMENTS, type DemoDocument } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const ocrLevel: Record<DemoDocument['ocrStatus'], { level: SignalLevel; key: TranslationKey }> = {
  COMPLETED: { level: 'ok', key: 'docOcrDone' },
  PROCESSING: { level: 'attention', key: 'docOcrRunning' },
  PENDING: { level: 'attention', key: 'docOcrQueued' },
  FAILED: { level: 'critical', key: 'docOcrFailed' },
  SKIPPED: { level: 'info', key: 'docOcrSkipped' },
};

function size(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
}

/** Tier chip: T3 carries a lock — the one tier that never reaches third-party AI. */
export function TierChip({ tier }: { tier: DemoDocument['tier'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 font-mono text-[11px] font-medium leading-5',
        tier === 'T3' ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground ring-1 ring-inset ring-border',
      )}
    >
      {tier === 'T3' ? <Lock className="size-3" aria-hidden /> : null}
      {tier}
    </span>
  );
}

const INCOMING: DemoDocument = {
  filename: 'fir_412_ps_gulberg.jpg',
  docType: 'FIR',
  ocrStatus: 'PROCESSING',
  sizeBytes: 920_000,
  caseRef: 'WK-1042',
  client: 'Ahmed Raza',
  tier: 'T3',
  source: 'WhatsApp',
  added: 'now',
  indexed: false,
};

export function DocumentsView() {
  const { t } = useLanguage();
  const { play } = useDemo();
  const [progress, setProgress] = useState(0);
  const [docs, setDocs] = useState<DemoDocument[]>(DOCUMENTS);

  // A client's FIR photo arrives over WhatsApp: upload → OCR → indexed.
  useEffect(() => {
    if (progress >= 100) return;
    let indexTimer = 0;
    const id = window.setTimeout(() => {
      const next = Math.min(100, progress + 7);
      setProgress(next);
      if (next < 100) return;
      setDocs((list) => (list.some((d) => d.filename === INCOMING.filename) ? list : [INCOMING, ...list]));
      play('tick');
      indexTimer = window.setTimeout(
        () => setDocs((list) => list.map((d) => (d.filename === INCOMING.filename ? { ...d, ocrStatus: 'COMPLETED', indexed: true } : d))),
        2600,
      );
    }, 140);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(indexTimer);
    };
  }, [progress, play]);

  const t3 = docs.filter((d) => d.tier === 'T3').length;
  const processing = docs.filter((d) => d.ocrStatus === 'PROCESSING' || d.ocrStatus === 'PENDING').length;
  const indexed = docs.filter((d) => d.indexed).length;

  return (
    <DemoPage>
      <PageHeader
        eyebrow={`${docs.length} ${t('documents')} · ${t3} T3`}
        title={t('demoVaultTitle')}
        description={t('demoVaultLede')}
        action={
          <Button size="sm" className="h-8">
            <Upload aria-hidden />
            {t('docUpload')}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [t('docProtected'), t3, t('docProtectedHint'), 'T3'],
          [t('docProcessing'), processing, t('docProcessingHint'), 'OCR'],
          [t('docSearchable'), `${Math.round((indexed / docs.length) * 100)}%`, t('docSearchableHint'), 'RAG'],
        ].map(([label, value, hint, code]) => (
          <div key={String(code)} className="rounded-xl bg-card p-4 ring-1 ring-border">
            <p className="docket flex justify-between text-muted-foreground">
              {label}
              <span>{code}</span>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {progress < 100 ? (
        <div className="mb-4 flex items-center gap-4 rounded-xl bg-card px-4 py-3 ring-1 ring-primary/30">
          <FileImage className="size-5 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex justify-between gap-3 text-[13px]">
              <span className="truncate font-mono">{INCOMING.filename}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{progress}%</span>
            </p>
            <Meter className="mt-2" value={progress} />
            <Docket className="mt-1.5" items={[t('docArriving'), INCOMING.caseRef, INCOMING.client]} />
          </div>
        </div>
      ) : null}

      <Panel bodyClassName="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-sunken/70 text-start">
            <tr>
              {[t('docFile'), t('mfMatter'), t('docTier'), t('docOcr'), t('docSource'), t('docAdded'), t('docSize')].map((h) => (
                <th key={h} scope="col" className="docket px-4 py-2 text-start font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.map((d) => {
              const ocr = ocrLevel[d.ocrStatus];
              return (
                <tr key={d.filename} className={cn('transition-colors hover:bg-muted/40', d.filename === INCOMING.filename && 'row-arrive')}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.filename}</span>
                        <span className="docket text-muted-foreground">{d.docType.replace('_', ' ')}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block font-mono">{d.caseRef}</span>
                    <span className="text-xs text-muted-foreground">{d.client}</span>
                  </td>
                  <td className="px-4 py-2.5"><TierChip tier={d.tier} /></td>
                  <td className="px-4 py-2.5"><Signal level={ocr.level}>{t(ocr.key)}</Signal></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.source}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">{d.added}</td>
                  <td className="px-4 py-2.5 text-end font-mono tabular-nums text-muted-foreground">{size(d.sizeBytes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        {t('lpT3Rule')}
      </p>
    </DemoPage>
  );
}
