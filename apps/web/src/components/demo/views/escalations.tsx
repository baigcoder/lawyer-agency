'use client';

import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { DemoPage, useDemo } from '@/components/demo/demo-context';
import { HandoffBriefView } from '@/components/escalations/handoff-brief-view';
import { PageHeader } from '@/components/page-header';
import { Docket, Signal, signalRule, type SignalLevel } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/workspace/panel';
import { SlaClock } from '@/components/workspace/sla-clock';
import type { DemoEscalation } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

function levelOf(e: DemoEscalation): SignalLevel {
  if (e.status === 'RESOLVED') return 'info';
  if (e.status === 'ACKNOWLEDGED') return 'routine';
  return e.trigger === 'IMMINENT_DEADLINE' ? 'urgent' : 'critical';
}

export function EscalationsView() {
  const { t } = useLanguage();
  const { escalations, selectedEscalation, setSelectedEscalation, acknowledge, resolve, go, conversations } = useDemo();
  const active = escalations.find((e) => e.id === selectedEscalation) ?? escalations[0];
  const open = escalations.filter((e) => e.status === 'OPEN').length;

  return (
    <DemoPage>
      <PageHeader
        eyebrow={`${open} ${t('demoOpenEsc')} · ${t('demoSlaTarget')}`}
        title={t('escalations')}
        description={t('demoEscLede')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel title={t('demoQueue')} meta={t('demoQueueMeta')} bodyClassName="p-1.5">
          <ul className="space-y-1">
            {escalations.map((e) => {
              const level = levelOf(e);
              const selected = e.id === active?.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEscalation(e.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'relative w-full rounded-lg px-4 py-3 text-start transition-colors',
                      'before:absolute before:inset-y-3 before:start-0 before:w-[3px] before:rounded-full',
                      signalRule(level),
                      selected ? 'bg-accent/50 ring-1 ring-primary/25' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <Signal level={level}>{t(`escTrigger${e.trigger}`)}</Signal>
                      {e.status === 'OPEN' && e.deadline ? (
                        <SlaClock deadline={e.deadline} />
                      ) : (
                        <span className="docket text-muted-foreground">{e.status === 'ACKNOWLEDGED' ? t('demoClaimed') : t('demoResolved')}</span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-[13.5px] font-medium">{e.client}</span>
                    <Docket items={[e.caseRef, e.assignee ?? t('demoUnassigned')]} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {active ? (
          <Panel
            title={
              <span className="flex items-center gap-2">
                {active.client}
                <span className="font-mono text-xs font-normal text-muted-foreground">{active.caseRef}</span>
              </span>
            }
            meta={`${t(`escTrigger${active.trigger}`)} · ${active.assignee ?? t('demoUnassigned')}`}
            action={
              active.status === 'OPEN' && active.deadline ? <SlaClock deadline={active.deadline} className="text-sm" /> : null
            }
            bodyClassName="p-5"
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {active.status === 'OPEN' ? (
                <Button className="h-9" onClick={() => acknowledge(active.id)}>
                  {t('escAckClaim')}
                </Button>
              ) : null}
              {active.status === 'ACKNOWLEDGED' ? (
                <Button className="h-9" variant="outline" onClick={() => resolve(active.id)}>
                  <CheckCircle2 aria-hidden />
                  {t('demoMarkResolved')}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => {
                  const conv = conversations.find((c) => c.caseRef === active.caseRef);
                  go('inbox', conv ? { conversation: conv.id } : undefined);
                }}
              >
                <MessageSquareText aria-hidden />
                {t('demoOpenConversation')}
              </Button>
              {active.status !== 'OPEN' ? (
                <span className="ms-auto self-center">
                  <Signal level={active.status === 'RESOLVED' ? 'ok' : 'routine'}>
                    {active.status === 'RESOLVED' ? t('demoResolved') : `${t('demoClaimed')} · ${active.assignee}`}
                  </Signal>
                </span>
              ) : null}
            </div>
            <HandoffBriefView reason={active.brief.reason} excerpt={active.excerpt} brief={active.brief} />
          </Panel>
        ) : null}
      </div>
    </DemoPage>
  );
}
