'use client';

import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { DemoPage } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Meter, Panel } from '@/components/workspace/panel';
import { KNOWLEDGE, type KnowledgeArticle } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const statusOf: Record<KnowledgeArticle['status'], { level: SignalLevel; key: TranslationKey }> = {
  APPROVED: { level: 'ok', key: 'kbApproved' },
  IN_REVIEW: { level: 'attention', key: 'kbInReview' },
  DRAFT: { level: 'info', key: 'kbDraft' },
};

const SAMPLE_BODY: Record<string, string> = {
  'Consultation fees & office hours':
    'A first consultation is PKR 5,000 and lasts up to 45 minutes. Chambers are open Monday to Friday 09:00–18:00 and Saturday 10:00–14:00. Fees for court work are quoted after the consultation, in writing.',
};

export function KnowledgeView() {
  const { t } = useLanguage();
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<string>(KNOWLEDGE[0]?.title ?? '');
  const categories = Array.from(new Set(KNOWLEDGE.map((k) => k.category)));
  const rows = KNOWLEDGE.filter((k) => category === 'all' || k.category === category);
  const active = KNOWLEDGE.find((k) => k.title === selected) ?? rows[0];
  const maxUse = Math.max(...KNOWLEDGE.map((k) => k.used7d), 1);

  return (
    <DemoPage>
      <PageHeader
        eyebrow={`${KNOWLEDGE.filter((k) => k.status === 'APPROVED').length} ${t('kbApproved')} · ${t('kbOnlySource')}`}
        title={t('demoLibraryTitle')}
        description={t('demoLibraryLede')}
        action={
          <Button size="sm" className="h-8">
            <Plus aria-hidden />
            {t('kbNew')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,0.9fr)]">
        <nav aria-label={t('kbCategories')} className="flex gap-1 overflow-x-auto lg:flex-col">
          {['all', ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                category === c ? 'bg-card font-medium shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {c === 'all' ? t('demoAll') : c}
              <span className="font-mono text-[11px] text-muted-foreground">
                {c === 'all' ? KNOWLEDGE.length : KNOWLEDGE.filter((k) => k.category === c).length}
              </span>
            </button>
          ))}
        </nav>

        <Panel bodyClassName="divide-y divide-border">
          {rows.map((k) => {
            const s = statusOf[k.status];
            return (
              <button
                key={k.title}
                type="button"
                onClick={() => setSelected(k.title)}
                aria-current={active?.title === k.title ? 'true' : undefined}
                className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 text-start transition-colors', active?.title === k.title ? 'bg-accent/45' : 'hover:bg-muted/40')}
              >
                <span className="truncate text-[13.5px] font-medium">{k.title}</span>
                <Signal level={s.level}>{t(s.key)}</Signal>
                <Docket items={[k.category, k.languages, k.approvedBy]} />
                <span className="flex w-28 items-center gap-2">
                  <Meter value={k.used7d} max={maxUse} className="flex-1" tone={k.used7d ? 'primary' : 'muted'} />
                  <span className="w-6 text-end font-mono text-[11px] tabular-nums text-muted-foreground">{k.used7d}</span>
                </span>
              </button>
            );
          })}
        </Panel>

        {active ? (
          <article className="rounded-xl bg-card p-5 ring-1 ring-border lg:col-span-2 xl:col-span-1">
            <Docket items={[active.category, `${t('kbUpdated')} ${active.updated}`]} />
            <h2 className="mt-2 font-display text-2xl leading-tight">{active.title}</h2>
            <p className="ruled mt-4 text-[13.5px] leading-7">
              {SAMPLE_BODY[active.title] ?? t('kbSampleBody')}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <BookOpen className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground">
                {active.used7d} {t('kbUsedAnswers')}
              </span>
              <span className="ms-auto">
                <Signal level={statusOf[active.status].level}>
                  {active.approvedBy ? `${t('kbApprovedBy')} ${active.approvedBy}` : t(statusOf[active.status].key)}
                </Signal>
              </span>
            </div>
          </article>
        ) : null}
      </div>
    </DemoPage>
  );
}
