'use client';

import { CheckCircle2 } from 'lucide-react';
import { DemoPage } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Docket } from '@/components/signal';
import { Meter, Panel } from '@/components/workspace/panel';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';

const STEPS: Array<[TranslationKey, string]> = [
  ['setupS1', '12 Sep'],
  ['setupS2', '12 Sep'],
  ['setupS3', '13 Sep'],
  ['setupS4', '13 Sep'],
  ['setupS5', '14 Sep'],
];

export function SetupView() {
  const { t } = useLanguage();
  return (
    <DemoPage>
      <PageHeader eyebrow="5 / 5" title={t('setup')} description={t('setupLede')} />
      <Panel className="max-w-2xl" title={t('launchPath')} meta={t('launchComplete')} bodyClassName="p-5">
        <Meter value={100} />
        <ol className="mt-5 space-y-4">
          {STEPS.map(([key, date]) => (
            <li key={key} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-[13.5px] font-medium">{t(key)}</p>
                <Docket items={[t('demoDone'), date]} />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </DemoPage>
  );
}
