'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { CheckCheck, FileText, Pause, Play } from 'lucide-react';
import { ApprovalGate } from '@/components/approval-gate';
import { Docket, Signal } from '@/components/signal';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

/**
 * The one matter the marketing site and the demo both tell the story of, so
 * the hero and the walkthrough show the *same* product state.
 * Client messages stay in Roman Urdu in both UI languages — that is how
 * clients actually write.
 */
export const DEMO_MATTER = {
  reference: 'WK-1042',
  client: 'Ahmed Raza',
  phone: '+92 300 •••• 412',
  firm: 'Al-Madad Law Associates',
  fir: '412/26 · PS Gulberg',
  lawyer: 'Ayesha Khan',
  lawyerInitials: 'AK',
  thread: {
    c1: 'Assalam o alaikum. Mere bhai ko kal raat police le gayi. FIR ho gayi hai, kal subah Cantt court mein peshi hai.',
    a1: 'Wa alaikum assalam. Main Al-Madad Law ka AI intake assistant hoon — qanooni mashwara nahi deta, aap ki baat wakeel tak pohanchata hoon. Aap ka naam aur shehar?',
    c2: 'Ahmed Raza, Lahore. FIR 412/26, Thana Gulberg.',
    draft:
      'Ahmed sahab, Ayesha Khan sahiba aap ka maamla dekh rahi hain. Baraye meharbani FIR ki copy aur CNIC yahan bhej dein.',
  },
} as const;

const STEPS: TranslationKey[] = [
  'mfStep1',
  'mfStep2',
  'mfStep3',
  'mfStep4',
  'mfStep5',
  'mfStep6',
  'mfStep7',
];
const LAST = STEPS.length;
const STEP_MS = 2200;
const HOLD_MS = 6000;
const TYPING_MS = 1000;
const SLA_START = 15 * 60;

/**
 * Opacity/transform-only reveal → no layout shift. `fresh` marks the element
 * the current step just produced with a one-off emerald halo, so the eye
 * follows the state change the way it would in the live product.
 */
function Reveal({
  on,
  fresh,
  delay,
  children,
  className,
}: {
  on: boolean;
  fresh?: boolean;
  delay?: number;
  children: ReactNode;
  className?: string;
}) {
  const style: CSSProperties | undefined = delay ? { transitionDelay: on ? `${delay}ms` : '0ms' } : undefined;
  return (
    <div data-on={on} style={style} className={cn('reveal rounded-xl', on && fresh && 'fresh', className)}>
      {children}
    </div>
  );
}

function Bubble({ from, children, time }: { from: 'client' | 'ai'; children: ReactNode; time: string }) {
  const client = from === 'client';
  return (
    <div className={cn('flex', client ? 'justify-start' : 'justify-end')}>
      <p
        dir="ltr"
        className={cn(
          'max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-[1.55] text-start',
          client
            ? 'rounded-ss-sm bg-card text-foreground ring-1 ring-border'
            : 'rounded-se-sm bg-[var(--wa-firm)] text-foreground ring-1 ring-primary/15',
        )}
      >
        {children}
        <span className="ms-2 inline-flex translate-y-0.5 items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
          {time}
          {!client ? <CheckCheck className="size-3 text-primary" aria-hidden /> : null}
        </span>
      </p>
    </div>
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex justify-end">
      <span className="flex items-center gap-2 rounded-xl rounded-se-sm bg-[var(--wa-firm)] px-3 py-2.5 ring-1 ring-primary/15">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot size-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Wakeel Matter Frame — hero artefact. Seven real product states play in
 * sequence: message → facts → urgency → docket → documents → handoff →
 * approval gate, with the beats a live intake actually has (the assistant
 * typing, facts landing one by one, the escalation SLA starting to run).
 * Pauses on hover/focus; under reduced motion it renders the completed
 * matter statically.
 */
export function MatterFrame({ className }: { className?: string }) {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const reduced = useReducedMotion();
  const [rawStep, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [typingDone, setTypingDone] = useState(false);
  const [slaElapsed, setSlaElapsed] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const running = playing && !hovered && !reduced;
  // Reduced motion: the completed matter, statically.
  const step = reduced ? LAST : rawStep;
  const typing = step === 2 && running && !typingDone;
  const sla = SLA_START - slaElapsed;

  // Advance the story; looping back resets the per-run beats.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(
      () => {
        setStep((s) => (s >= LAST ? 1 : s + 1));
        if (rawStep >= LAST) setSlaElapsed(0);
        if (rawStep === 1) setTypingDone(false);
      },
      rawStep >= LAST ? HOLD_MS : STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [rawStep, running]);

  // The assistant "types" before its first reply lands.
  useEffect(() => {
    if (!typing) return;
    const id = window.setTimeout(() => setTypingDone(true), TYPING_MS);
    return () => window.clearTimeout(id);
  }, [typing]);

  // Escalation SLA starts the moment urgency is detected.
  useEffect(() => {
    if (step < 3 || !running) return;
    const id = window.setInterval(() => setSlaElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [step, running]);

  const on = (n: number) => step >= n;
  const fresh = (n: number) => step === n && !reduced;
  const replied = on(3) || (on(2) && !typing);
  const m = DEMO_MATTER;
  const facts: Array<[string, string]> = [
    [t('mfClient'), `${m.client} · ${t('mfLahore')}`],
    [t('mfMatter'), t('mfMatterValue')],
    [t('mfFir'), m.fir],
    [t('mfNextDate'), t('mfNextDateValue')],
  ];

  return (
    <figure
      ref={rootRef}
      className={cn('matter-frame overflow-hidden rounded-2xl bg-background text-foreground', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      <figcaption className="sr-only">{t('mfSrSummary')}</figcaption>

      {/* Frame chrome */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-[#25d366]/15 text-[#128c4a] dark:text-[#3fe07f]">
            <WhatsappGlyph />
            {running && step < LAST ? (
              <span aria-hidden className="live-ping absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary" />
            ) : null}
          </span>
          <Docket items={[m.client, m.phone]} className="truncate text-foreground/80" />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {on(3) ? (
            <span className="reveal-in font-mono text-xs tabular-nums text-critical" aria-hidden>
              SLA {formatClock(sla)}
            </span>
          ) : null}
          <Signal level={step >= LAST ? 'attention' : 'ok'}>
            {step >= LAST ? t('mfAwaiting') : t('mfLive')}
          </Signal>
        </div>
      </div>

      <div aria-hidden className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Thread */}
        <div className="flex flex-col gap-2.5 border-b border-border bg-sunken p-3.5 sm:border-e sm:border-b-0">
          <Reveal on={on(1)} fresh={fresh(1)}>
            <Bubble from="client" time="23:42">{m.thread.c1}</Bubble>
          </Reveal>
          <div className="relative">
            <Reveal on={replied} fresh={fresh(2)}>
              <p className={cn('mb-1 text-end text-[11px] text-muted-foreground', urdu)}>{t('mfAiDisclosed')}</p>
              <Bubble from="ai" time="23:42">{m.thread.a1}</Bubble>
            </Reveal>
            {typing ? (
              <div className="absolute inset-x-0 top-0">
                <TypingDots label={t('mfTyping')} />
              </div>
            ) : null}
          </div>
          <Reveal on={replied} delay={on(3) ? 0 : 700}>
            <Bubble from="client" time="23:43">{m.thread.c2}</Bubble>
          </Reveal>
          <Reveal on={on(7)} fresh={fresh(7)} className="mt-auto">
            <ApprovalGate demo emphasize={step === LAST && running} meta={t('mfToClient')} className="bg-card/60">
              <span dir="ltr" className="block text-start">{m.thread.draft}</span>
            </ApprovalGate>
          </Reveal>
        </div>

        {/* Matter record */}
        <div className="flex flex-col gap-3 bg-card p-4">
          <div>
            <p className="docket text-muted-foreground">{t('mfRecord')}</p>
            <div className="mt-1 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-mono text-lg font-medium tracking-tight tabular-nums">
                {on(4) ? (
                  <span key="ref" className={cn('inline-block', fresh(4) && 'docket-stamp')}>
                    {m.reference}
                  </span>
                ) : (
                  <span className={cn('forming text-sm text-muted-foreground', urdu)}>{t('mfForming')}</span>
                )}
              </p>
              <Reveal on={on(3)} fresh={fresh(3)} className="px-1">
                <Signal level="critical">{t('mfUrgent')}</Signal>
              </Reveal>
            </div>
          </div>

          <dl className={cn('divide-y divide-border rounded-lg ring-1 transition-colors duration-500', replied ? 'ring-border' : 'ring-transparent')}>
            {facts.map(([k, v], i) => (
              <Reveal key={k} on={replied} delay={on(3) ? 0 : 250 + i * 220} className="rounded-none">
                <div
                  className={cn(
                    'grid grid-cols-[88px_minmax(0,1fr)] gap-2 px-3 py-1.5 text-[12.5px]',
                    fresh(2) && 'fact-scan',
                  )}
                  style={fresh(2) ? { animationDelay: `${250 + i * 220}ms` } : undefined}
                >
                  <dt className={cn('text-muted-foreground', urdu)}>{k}</dt>
                  <dd className={cn('font-medium', urdu)}>{v}</dd>
                </div>
              </Reveal>
            ))}
          </dl>

          <Reveal on={on(5)} fresh={fresh(5)}>
            <p className="docket mb-1.5 text-muted-foreground">{t('documents')}</p>
            <ul className="space-y-1">
              {[t('mfDocFir'), t('mfDocCnic')].map((doc) => (
                <li key={doc} className="flex items-center gap-2 text-[12.5px]">
                  <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className={cn('flex-1 truncate', urdu)}>{doc}</span>
                  <span className="docket text-attention">{t('mfRequested')}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal on={on(6)} fresh={fresh(6)} className="mt-auto">
            <div className="flex items-center gap-3 rounded-lg bg-primary/[0.06] px-3 py-2.5 ring-1 ring-primary/20">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {m.lawyerInitials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {m.lawyer} <span className={cn('text-muted-foreground', urdu)}>· {t('mfAdvocateHc')}</span>
                </p>
                <p className={cn('text-xs text-primary', urdu)}>{t('mfBriefReady')}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Step rail — real controls; the artefact above is decorative */}
      <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={playing ? t('mfPause') : t('mfPlay')}
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {STEPS.map((key, i) => {
            const n = i + 1;
            const current = step === n;
            return (
              <li key={key} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(n);
                    setPlaying(false);
                    setTypingDone(true);
                  }}
                  aria-current={current ? 'step' : undefined}
                  className="group flex w-full min-w-11 flex-col gap-1 rounded-md px-1 py-1 text-start focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-border group-hover:bg-muted-foreground/40">
                    {step > n || (current && !running) ? (
                      <span className="absolute inset-0 bg-primary" />
                    ) : current ? (
                      <span
                        key={step}
                        className="step-fill absolute inset-0 bg-primary"
                        style={{ animationDuration: `${n === LAST ? HOLD_MS : STEP_MS}ms` }}
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'truncate text-[11px] transition-colors',
                      current ? 'font-medium text-foreground' : step > n ? 'text-foreground/70' : 'text-muted-foreground',
                      urdu,
                    )}
                  >
                    <span className="hidden font-mono tabular-nums md:inline">0{n} </span>
                    {t(key)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}

export function WhatsappGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-3.5', className)} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
