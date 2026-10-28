'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCheck,
  Clock,
  FileText,
  LayoutDashboard,
  Mic,
  Pause,
  PhoneIncoming,
  PhoneMissed,
  Play,
  ShieldAlert,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { DEMO_MATTER, WhatsappGlyph } from '@/components/matter-frame';
import { Signal, SignalDot } from '@/components/signal';
import { DEMO_BRIEF } from '@/lib/demo-data';
import { useLandingCopy, type LandingCopy } from '@/lib/landing-copy';
import { useLanguage } from '@/lib/language';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { cn } from '@/lib/utils';

type TourUi = LandingCopy['tour']['ui'];

/** Scene order; must match `copy.tour.scenes`. */
const SCENE_KEYS = [
  'connect',
  'knowledge',
  'intake',
  'languages',
  'faq',
  'voice',
  'urgent',
  'alerts',
  'record',
  'documents',
  'handoff',
  'approval',
  'diary',
  'calls',
  'payments',
  'insights',
] as const;
type SceneKey = (typeof SCENE_KEYS)[number];

/** How long each scene holds before advancing, in scene order. */
const SCENE_MS = [6500, 6500, 7000, 6500, 6500, 7000, 7000, 6500, 6500, 7000, 7500, 7000, 7000, 7000, 6500, 7000];

/**
 * The landing-page product tour: sixteen short scenes, one per capability,
 * drawn with the product's own tokens instead of a pre-rendered video, so it
 * follows the theme and language toggles, stays sharp at any size and costs
 * a few kilobytes instead of ~10 MB.
 *
 * Timing is pure CSS: the active chapter's progress bar animates for the
 * scene's duration and its `animationend` advances the tour, so pausing is
 * just `animation-play-state`. It only runs while on screen, pauses on hover,
 * and under reduced motion it never autoplays — the viewer picks scenes.
 */
export function ProductTour() {
  const copy = useLandingCopy();
  const { dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const running = playing && visible && !hovered && !reduced;
  const scenes = copy.tour.scenes;
  const scene = scenes[index] ?? scenes[0];
  const ui = copy.tour.ui;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Keep the active chapter in view on the scrolling rail (phones) without
  // moving the page itself.
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.children[index];
    if (!rail || !(item instanceof HTMLElement) || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: item.offsetLeft - rail.clientWidth / 2 + item.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [index, reduced]);

  const select = (next: number) => {
    setIndex(next);
    if (reduced) return;
    setPlaying(true);
  };

  const advance = () => setIndex((i) => (i + 1) % scenes.length);

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-frame)]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* Caption column */}
        <div className="flex flex-col justify-between gap-6 border-b border-border p-5 sm:p-8 lg:border-b-0 lg:border-e">
          <div aria-live={running ? 'off' : 'polite'}>
            <p className="text-sm font-medium tabular-nums text-primary">
              <span className={urdu}>{copy.tour.scene}</span> {index + 1} <span className={urdu}>{copy.tour.of}</span> {scenes.length}
            </p>
            <h3 className={cn('mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]', urdu && 'font-urdu text-xl !leading-[1.75] tracking-normal sm:text-[1.4rem]')}>
              {scene?.title}
            </h3>
            <p className={cn('mt-3 text-[0.975rem] leading-7 text-muted-foreground', urdu)}>{scene?.body}</p>
          </div>
          {reduced ? (
            <p className={cn('text-xs leading-5 text-muted-foreground', urdu)}>{copy.tour.reduced}</p>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              <span className={urdu}>{playing ? copy.tour.pause : copy.tour.play}</span>
            </button>
          )}
        </div>

        {/* Stage: decorative; the caption above carries the meaning. */}
        <div aria-hidden className="relative flex h-[30rem] items-center sm:h-[28rem] justify-center overflow-hidden bg-sunken px-4 pb-4 pt-12 sm:px-8">
          <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {scene?.onPhone ? <Smartphone className="size-3.5" /> : <LayoutDashboard className="size-3.5" />}
            <span className={urdu}>{scene?.onPhone ? ui.surfaceClient : ui.surfaceFirm}</span>
          </span>
          <div key={`${index}-${dir}`} className="w-full max-w-[22rem]">
            <Scene scene={SCENE_KEYS[index] ?? 'intake'} ui={ui} urdu={urdu} reduced={reduced} />
          </div>
        </div>
      </div>

      {/* Chapters */}
      <nav aria-label={copy.tour.eyebrow} className="border-t border-border">
        <ol ref={railRef} className="flex snap-x overflow-x-auto lg:grid lg:grid-cols-8 lg:overflow-visible">
          {scenes.map((s, i) => {
            const active = i === index;
            return (
              <li key={s.label} className="min-w-[8.5rem] shrink-0 snap-start border-e border-border last:border-e-0 lg:min-w-0 lg:[&:nth-child(8n)]:border-e-0 lg:[&:nth-child(n+9)]:border-t">
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex w-full flex-col gap-2 px-4 pb-3 pt-3 text-start transition-colors hover:bg-muted focus-visible:-outline-offset-2',
                    active ? 'bg-background' : 'bg-card',
                  )}
                >
                  <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-border">
                    {active && !reduced ? (
                      <span
                        key={`${index}-${scenes.length}`}
                        className="tour-progress absolute inset-0 rounded-full bg-primary"
                        style={{ animationDuration: `${SCENE_MS[i] ?? 6500}ms`, animationPlayState: running ? 'running' : 'paused' }}
                        onAnimationEnd={advance}
                      />
                    ) : (
                      <span className={cn('absolute inset-0 rounded-full', active || i < index ? 'bg-primary' : 'bg-transparent')} />
                    )}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span className={cn('truncate text-sm', active ? 'font-semibold text-foreground' : 'text-muted-foreground', urdu)}>{s.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/* ── Scene primitives ────────────────────────────────────────────────── */

/** One staggered beat inside a scene. */
function Beat({
  at,
  pop,
  still,
  as: Tag = 'div',
  className,
  children,
}: {
  at: number;
  pop?: boolean;
  /** Render without the entrance (panels reused outside the tour). */
  still?: boolean;
  as?: 'div' | 'li';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn(!still && (pop ? 'tour-pop' : 'tour-beat'), className)} style={still ? undefined : { animationDelay: `${at}ms` }}>
      {children}
    </Tag>
  );
}

function ChatHeader({ ui, urdu }: { ui: TourUi; urdu?: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border bg-card px-3.5 py-2.5">
      <span className="flex size-7 items-center justify-center rounded-full bg-[#25d366]/15 text-[#128c4a] dark:text-[#3fe07f]">
        <WhatsappGlyph className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-semibold">{DEMO_MATTER.firm}</p>
        <p className={cn('text-[11px] text-muted-foreground', urdu)}>{ui.aiAssistant}</p>
      </div>
    </div>
  );
}

export function Chat({ ui, urdu, children }: { ui: TourUi; urdu?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-background ring-1 ring-border">
      <ChatHeader ui={ui} urdu={urdu} />
      <div dir="ltr" className="space-y-2 p-3">{children}</div>
    </div>
  );
}

export function Bubble({ from, time, children, className }: { from: 'client' | 'firm'; time?: string; children: ReactNode; className?: string }) {
  return (
    <div
      dir="ltr"
      className={cn(
        'w-fit max-w-[88%] rounded-xl px-3 py-2 text-start text-[12.5px] leading-relaxed',
        from === 'client' ? 'rounded-ss-sm bg-card ring-1 ring-border' : 'ms-auto rounded-se-sm bg-[var(--wa-firm)]',
        className,
      )}
    >
      {children}
      {time ? (
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {time}
          {from === 'firm' ? <CheckCheck className="size-3 text-primary" /> : null}
        </span>
      ) : null}
    </div>
  );
}

export function Panel({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-background ring-1 ring-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3.5 py-2.5">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        {meta ? <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{meta}</span> : null}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function Pill({ tone, children, className }: { tone: 'ok' | 'wait' | 'stop' | 'muted'; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        tone === 'ok' && 'bg-primary/10 text-primary',
        tone === 'wait' && 'bg-attention/12 text-attention',
        tone === 'stop' && 'bg-critical/10 text-critical',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

function Waveform() {
  const bars = [4, 7, 10, 6, 12, 8, 5, 9, 13, 7, 4, 8, 11, 6, 9, 5];
  return (
    <span className="flex h-6 items-center gap-[2px]">
      {bars.map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-primary/70" style={{ height: `${h * 1.5}px` }} />
      ))}
    </span>
  );
}

/** "Typing…" that appears at `at` and collapses away by `until`, when the reply lands. */
function Typing({ at, until }: { at: number; until: number }) {
  return (
    <div
      className="tour-typing ms-auto w-fit overflow-hidden rounded-xl rounded-se-sm bg-[var(--wa-firm)] px-3"
      style={{ animationDelay: `${at}ms`, animationDuration: `${until - at}ms` }}
    >
      <span className="flex gap-1 py-2.5">
        {[0, 1, 2].map((d) => (
          <span key={d} className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}

/** Live countdown for the escalation clock; static under reduced motion. */
function Countdown({ from, run }: { from: number; run: boolean }) {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [run]);
  return (
    <span className="tabular-nums">
      {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}

/* ── Scenes ──────────────────────────────────────────────────────────── */

function Scene({ scene, ui, urdu, reduced }: { scene: SceneKey; ui: TourUi; urdu?: string; reduced: boolean }) {
  const m = DEMO_MATTER;
  switch (scene) {
    case 'connect':
      return (
        <div className="space-y-3">
          <Panel title={<span className="flex items-center gap-2"><WhatsappGlyph className="size-4 text-[#128c4a] dark:text-[#3fe07f]" /> WhatsApp</span>}>
            <div className="flex items-center gap-4">
              <Beat at={150} pop className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-border">
                <QrMark className="size-24" />
              </Beat>
              <Beat at={500} className="min-w-0 text-[12.5px] leading-relaxed">
                <p className={cn('font-medium', urdu)}>{ui.scanQr}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">Settings · Linked devices</p>
              </Beat>
            </div>
          </Panel>
          <Beat at={2000} pop className="flex items-center justify-between gap-3 rounded-xl bg-background p-3 ring-1 ring-primary/30">
            <span className="flex items-center gap-2 text-[12.5px] font-medium">
              <SignalDot level="ok" />
              <span className={urdu}>{ui.connected}</span>
              <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">+92 42 •••• 7731</span>
            </span>
          </Beat>
          <Beat at={2800} pop>
            <Pill tone="ok" className="ms-auto flex w-fit">
              <Check className="size-3" />
              <span className={urdu}>{ui.autoReplyOn}</span>
            </Pill>
          </Beat>
        </div>
      );

    case 'knowledge': {
      const fields: Array<[string, string]> = [
        ['Title', 'Consultation fees'],
        ['Category', 'Fees'],
        ['Language', 'EN · UR'],
      ];
      return (
        <Panel title={<span className={urdu}>{ui.newEntry}</span>} meta="KB-07">
          <div className="space-y-2.5 text-[12.5px]">
            {fields.map(([k, v], i) => (
              <Beat key={k} at={200 + i * 450} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2" >
                <span dir="ltr" className="text-muted-foreground">{k}</span>
                <span dir="ltr" className="rounded-md bg-card px-2 py-1 ring-1 ring-border">{v}</span>
              </Beat>
            ))}
            <Beat at={1600}>
              <p dir="ltr" className="rounded-md bg-card px-2.5 py-2 leading-relaxed ring-1 ring-border">
                First consultation: PKR 5,000, 30 minutes, at the office or by video call. Fee is adjusted against the retainer if you instruct us.
              </p>
            </Beat>
            <Beat at={2600} pop className="flex items-center justify-end gap-2">
              <Pill tone="ok">
                <BookOpen className="size-3" />
                <span className={urdu}>{ui.published}</span>
              </Pill>
            </Beat>
          </div>
        </Panel>
      );
    }

    case 'intake':
      return (
        <Chat ui={ui} urdu={urdu}>
          <Beat at={150}>
            <Bubble from="client" time="23:42">Assalam o alaikum. Mere bhai ko kal raat police le gayi.</Bubble>
          </Beat>
          <Beat at={900}>
            <Bubble from="client" time="23:42">
              <span className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Mic className="size-3" />
                </span>
                <Waveform />
                <span className="font-mono text-[10px] text-muted-foreground">0:48</span>
              </span>
            </Bubble>
          </Beat>
          <Beat at={1600}>
            <Bubble from="client" time="23:43">
              <span className="flex items-center gap-2 rounded-md bg-sunken px-2 py-1.5 ring-1 ring-border">
                <FileText className="size-4 text-muted-foreground" />
                <span className="font-mono text-[11px]">FIR 412/26 · PS Gulberg</span>
              </span>
            </Bubble>
          </Beat>
          <Typing at={2300} until={3400} />
          <Beat at={3400}>
            <Bubble from="firm" time="23:43">
              Wa alaikum assalam. Main {m.firm} ka AI assistant hoon, wakeel nahi. Aap ka naam aur shehar?
            </Bubble>
          </Beat>
        </Chat>
      );

    case 'languages': {
      const rows: Array<{ tag: string; q: ReactNode; a: ReactNode; rtl?: boolean }> = [
        { tag: 'English', q: 'What are your office hours?', a: 'Monday to Saturday, 10:00 to 18:00.' },
        { tag: 'اردو', q: 'مشاورت کی فیس کتنی ہے؟', a: 'مشاورت کی فیس 5,000 روپے ہے۔', rtl: true },
        { tag: 'Roman Urdu', q: 'Office kahan hai?', a: 'Office 14 Mall Road, Lahore par hai.' },
      ];
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <Beat key={r.tag} at={200 + i * 1300} className="rounded-xl bg-background p-3 ring-1 ring-border">
              <p className={cn('mb-2 text-[11px] font-medium text-muted-foreground', r.rtl && 'font-urdu')}>{r.tag}</p>
              <div className="grid grid-cols-2 gap-2">
                <p dir={r.rtl ? 'rtl' : 'ltr'} className={cn('rounded-lg rounded-ss-sm bg-card px-2.5 py-1.5 text-[12px] ring-1 ring-border', r.rtl && 'font-urdu text-[12.5px] leading-[2]')}>
                  {r.q}
                </p>
                <Beat at={200 + i * 1300 + 600}>
                  <p dir={r.rtl ? 'rtl' : 'ltr'} className={cn('rounded-lg rounded-se-sm bg-[var(--wa-firm)] px-2.5 py-1.5 text-[12px]', r.rtl && 'font-urdu text-[12.5px] leading-[2]')}>
                    {r.a}
                  </p>
                </Beat>
              </div>
            </Beat>
          ))}
        </div>
      );
    }

    case 'faq':
      return (
        <div className="space-y-3">
          <Chat ui={ui} urdu={urdu}>
            <Beat at={150}>
              <Bubble from="client" time="10:12">Consultation fee kitni hai? Saturday ko office khula hota hai?</Bubble>
            </Beat>
            <Typing at={900} until={1900} />
            <Beat at={1900}>
              <Bubble from="firm" time="10:12">Consultation fee PKR 5,000 hai. Saturday ko office 10 se 2 baje tak khula hai.</Bubble>
            </Beat>
          </Chat>
          <Beat at={2800} pop className="flex items-center gap-2.5 rounded-xl bg-background p-3 ring-1 ring-primary/30">
            <BookOpen className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 text-[12px]">
              <p className={cn('font-medium', urdu)}>
                {ui.source}: <span dir="ltr">Fees &amp; office hours</span>
              </p>
              <p className={cn('text-muted-foreground', urdu)}>{ui.autoSent}</p>
            </div>
          </Beat>
        </div>
      );

    case 'voice':
      return (
        <Chat ui={ui} urdu={urdu}>
          <Beat at={150}>
            <Bubble from="client" time="20:15">
              <span className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Mic className="size-3" />
                </span>
                <Waveform />
                <span className="font-mono text-[10px] text-muted-foreground">0:36</span>
              </span>
            </Bubble>
          </Beat>
          <Beat at={1000} className="max-w-[88%] rounded-lg border border-dashed border-border px-3 py-2 text-[12px] leading-relaxed">
            <span className={cn('block text-[10.5px] font-medium text-primary', urdu)}>{ui.transcribed}</span>
            Mera plot qabze mein hai, registry mere naam hai. Kya appointment mil sakti hai?
          </Beat>
          <Typing at={2000} until={3000} />
          <Beat at={3000}>
            <Bubble from="firm" time="20:16">
              <span className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Play className="ms-px size-3" />
                </span>
                <Waveform />
                <span className="font-mono text-[10px] text-muted-foreground">0:19</span>
              </span>
            </Bubble>
          </Beat>
          <Beat at={3600} className={cn('text-end text-[11px] text-muted-foreground', urdu)}>
            {ui.voiceReply}
          </Beat>
        </Chat>
      );

    case 'alerts':
      return (
        <div className="space-y-3">
          <Beat at={200} pop className="flex gap-3 rounded-xl bg-background p-3 shadow-[var(--shadow-frame)] ring-1 ring-border">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bell className="size-4" />
            </span>
            <div className="min-w-0 text-[12.5px] leading-snug">
              <p className="flex items-center justify-between gap-2">
                <span className="font-semibold">Wakeel</span>
                <span className="font-mono text-[10px] text-muted-foreground">23:44</span>
              </p>
              <p className={cn('mt-0.5 font-medium', urdu)}>{ui.alertTitle}</p>
              <p dir="ltr" className="text-muted-foreground">{m.client} · {m.reference} · {ui.trigger}</p>
            </div>
          </Beat>
          <Beat at={1300}>
            <div dir="ltr" className="w-fit max-w-[92%] rounded-xl rounded-ss-sm bg-card px-3 py-2 text-[12.5px] leading-relaxed ring-1 ring-border">
              <span className="block text-[10.5px] font-medium text-primary">Wakeel · {m.firm}</span>
              Urgent: {m.reference} ({m.client}) has been assigned to you. Hearing tomorrow 09:00.
              <span className="mt-0.5 block text-end text-[10px] text-muted-foreground">23:44</span>
            </div>
          </Beat>
          <Beat at={2300} className="flex flex-wrap justify-end gap-1.5">
            <Pill tone="muted">
              <Bell className="size-3" />
              <span className={urdu}>{ui.browserPush}</span>
            </Pill>
            <Pill tone="muted">
              <WhatsappGlyph className="size-3" />
              <span className={urdu}>{ui.waAlert}</span>
            </Pill>
          </Beat>
        </div>
      );

    case 'urgent':
      return (
        <div className="space-y-3">
          <Chat ui={ui} urdu={urdu}>
            <Beat at={150}>
              <Bubble from="client" time="23:44">Police ne bhai ko arrest kar liya hai, kal subah peshi hai.</Bubble>
            </Beat>
          </Chat>
          <Beat at={1100} pop className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2.5 text-critical ring-1 ring-critical/30">
            <ShieldAlert className="size-4 shrink-0" />
            <p className={cn('text-[12.5px] font-semibold', urdu)}>
              {ui.trigger} · {ui.automationStopped}
            </p>
          </Beat>
          <Beat at={2100}>
            <Panel title={<span className={urdu}>{ui.escalation}</span>} meta={m.reference}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{m.client}</p>
                  <p className={cn('text-[11px] text-muted-foreground', urdu)}>
                    {ui.respondIn} <span className="font-mono text-critical"><Countdown from={900} run={!reduced} /></span>
                  </p>
                </div>
                <span className={cn('rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground', urdu)}>{ui.claim}</span>
              </div>
            </Panel>
          </Beat>
        </div>
      );

    case 'record': {
      const facts: Array<[string, string]> = [
        [ui.client, m.client],
        [ui.city, 'Lahore'],
        [ui.policeStation, 'PS Gulberg'],
        ['FIR', '412/26'],
        [ui.nextHearing, 'Tomorrow 09:00 · Cantt courts'],
      ];
      return (
        <Panel title={<span dir="ltr">{m.reference} · Criminal · post-arrest bail</span>}>
          <dl className="space-y-2">
            {facts.map(([k, v], i) => (
              <Beat key={k} at={300 + i * 650} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-2 text-[12.5px] last:border-0 last:pb-0">
                <dt className={cn('text-muted-foreground', urdu)}>{k}</dt>
                <dd dir="ltr" className="tour-highlight rounded px-1 text-end font-medium" style={{ animationDelay: `${300 + i * 650}ms` }}>
                  {v}
                </dd>
              </Beat>
            ))}
          </dl>
        </Panel>
      );
    }

    case 'documents': {
      const docs: Array<{ name: string; done: boolean }> = [
        { name: 'FIR copy', done: true },
        { name: 'CNIC of accused (front & back)', done: false },
        { name: 'Vakalatnama', done: false },
      ];
      return (
        <div className="space-y-3">
          <Chat ui={ui} urdu={urdu}>
            <Beat at={150}>
              <Bubble from="firm" time="09:05">Baraye meharbani FIR ki copy aur CNIC yahan bhej dein.</Bubble>
            </Beat>
            <Beat at={1000}>
              <Bubble from="client" time="09:07">
                <span className="flex items-center gap-2 rounded-md bg-sunken px-2 py-1.5 ring-1 ring-border">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-mono text-[11px]">FIR_412.jpg</span>
                </span>
              </Bubble>
            </Beat>
          </Chat>
          <Beat at={1700}>
            <Panel title={<span dir="ltr">{m.reference}</span>}>
              <ul className="space-y-2">
                {docs.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span dir="ltr" className="truncate">{d.name}</span>
                    {d.done ? (
                      <Beat at={2300 + i * 200} pop>
                        <Pill tone="ok">
                          <Check className="size-3" />
                          <span className={urdu}>{ui.received}</span>
                        </Pill>
                      </Beat>
                    ) : (
                      <Pill tone="wait">
                        <Clock className="size-3" />
                        <span className={urdu}>{ui.requested}</span>
                      </Pill>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          </Beat>
        </div>
      );
    }

    case 'handoff':
      return (
        <Panel title={<span dir="ltr">{m.reference} · {DEMO_BRIEF.matterType}</span>}>
          <div className="space-y-3 text-[12.5px]">
            <Beat at={200}>
              <Signal level="critical">{ui.trigger}</Signal>
              <p dir="ltr" className="mt-1.5 leading-relaxed text-foreground/90">{DEMO_BRIEF.reason}</p>
            </Beat>
            <Beat at={1100}>
              <p className={cn('text-[11px] font-medium text-muted-foreground', urdu)}>{ui.missing}</p>
              <p dir="ltr" className="mt-0.5 leading-relaxed">{DEMO_BRIEF.openItems[0]}</p>
            </Beat>
            <Beat at={2000}>
              <p className={cn('text-[11px] font-medium text-muted-foreground', urdu)}>{ui.nextStep}</p>
              <p dir="ltr" className="mt-0.5 leading-relaxed">{DEMO_BRIEF.nextAction}</p>
            </Beat>
            <Beat at={2900} pop className="flex items-center gap-2.5 rounded-lg bg-primary/8 p-2.5 ring-1 ring-primary/25">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{m.lawyerInitials}</span>
              <div className="leading-tight">
                <p className={cn('text-[11px] text-muted-foreground', urdu)}>{ui.assignedTo}</p>
                <p className="text-[13px] font-semibold">{m.lawyer}</p>
              </div>
            </Beat>
          </div>
        </Panel>
      );

    case 'approval':
      return (
        <div className="space-y-3">
          <Beat at={200} className="rounded-xl border border-dashed border-attention/60 bg-background p-3">
            <p className={cn('text-[11px] font-medium text-attention', urdu)}>{ui.draft}</p>
            <p dir="ltr" className="mt-1.5 text-[12.5px] leading-relaxed">{m.thread.draft}</p>
            <div className="mt-3 flex justify-end gap-2">
              <span className={cn('rounded-md px-2.5 py-1 text-[12px] ring-1 ring-border', urdu)}>{ui.edit}</span>
              <span className={cn('tour-press rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground', urdu)}>{ui.approve}</span>
            </div>
          </Beat>
          <Beat at={2400}>
            <Bubble from="firm" time="23:51">{m.thread.draft}</Bubble>
          </Beat>
          <Beat at={3100} className="flex flex-wrap items-center justify-end gap-x-2 text-[11px] text-muted-foreground">
            <Check className="size-3.5 text-primary" />
            <span className={urdu}>{ui.approved}</span>
            <span className="font-medium text-foreground">{m.lawyer}</span>
            <span className="font-mono">· 23:51</span>
          </Beat>
        </div>
      );

    case 'diary':
      return (
        <div className="space-y-3">
          <CourtDiaryPanel ui={ui} urdu={urdu} animate />
          <Beat at={2000} className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <CalendarCheck className="size-4 text-primary" />
            <span className={urdu}>{ui.synced}</span>
          </Beat>
          <Beat at={2700}>
            <Bubble from="firm" time="16:20">Farah sahiba, aap ki mulaqat Tuesday 11:30 baje confirm hai.</Bubble>
          </Beat>
        </div>
      );

    case 'calls':
      return (
        <div className="space-y-3">
          <Beat at={150}>
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="live-ping absolute inset-0 rounded-full bg-primary" />
                    <span className="relative size-2 rounded-full bg-primary" />
                  </span>
                  <PhoneIncoming className="size-3.5 text-primary" />
                  <span className={urdu}>{ui.incomingCall}</span>
                </span>
              }
              meta="01:24"
            >
              <div dir="ltr" className="space-y-2 text-[12px] leading-relaxed">
                <Beat at={700}>
                  <p>
                    <span className="font-semibold text-primary">AI · </span>Assalam o alaikum, main {m.firm} ka AI receptionist hoon, wakeel nahi.
                  </p>
                </Beat>
                <Beat at={1700}>
                  <p>
                    <span className="font-semibold text-muted-foreground">Caller · </span>Mujhe property case ke baare mein baat karni hai.
                  </p>
                </Beat>
              </div>
            </Panel>
          </Beat>
          <Beat at={2600} className="flex items-center justify-between gap-3 rounded-xl bg-background p-3 ring-1 ring-border">
            <span className="flex items-center gap-2 text-[12.5px]">
              <PhoneMissed className="size-4 text-critical" />
              <span className={urdu}>{ui.missedCall}</span>
              <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">+92 321 •••• 870</span>
            </span>
          </Beat>
          <Beat at={3300} pop>
            <Pill tone="ok" className="ms-auto flex w-fit">
              <WhatsappGlyph className="size-3" />
              <span className={urdu}>{ui.followUp}</span>
            </Pill>
          </Beat>
        </div>
      );

    case 'payments':
      return (
        <div className="space-y-3">
          <Chat ui={ui} urdu={urdu}>
            <Beat at={150}>
              <Bubble from="client" time="14:02">
                <span className="block rounded-md bg-sunken px-2.5 py-2 ring-1 ring-border">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Wallet className="size-3.5" /> Easypaisa
                  </span>
                  <span className="mt-0.5 block font-mono text-[13px] font-semibold">PKR 15,000</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">TID 0193 •••• 552</span>
                </span>
              </Bubble>
            </Beat>
          </Chat>
          <Beat at={1100}>
            <Panel title={<span className={urdu}>{ui.paymentProof}</span>} meta="WK-1018">
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span dir="ltr">Retainer · PKR 15,000</span>
                <span className="relative inline-flex">
                  <span className={cn('tour-swap-out rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground', urdu)}>{ui.verify}</span>
                  <span className="tour-swap-in absolute inset-0 flex items-center justify-end">
                    <Pill tone="ok">
                      <Check className="size-3" />
                      <span className={urdu}>{ui.verified}</span>
                    </Pill>
                  </span>
                </span>
              </div>
            </Panel>
          </Beat>
        </div>
      );

    default:
      return <AnalyticsPanel ui={ui} urdu={urdu} animate />;
  }
}

/* ── Shared product panels (tour + landing spotlights) ───────────────── */

const QR_SIZE = 21;
const QR_FINDERS: Array<[number, number]> = [
  [0, 0],
  [QR_SIZE - 7, 0],
  [0, QR_SIZE - 7],
];

/** Deterministic QR-like mark; decorative only, encodes nothing. */
function QrMark({ className }: { className?: string }) {
  const inFinder = (x: number, y: number) => QR_FINDERS.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (!inFinder(x, y) && (x * 7 + y * 13 + x * y * 3) % 5 < 2) cells.push([x, y]);
    }
  }
  return (
    <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className={className} shapeRendering="crispEdges">
      {QR_FINDERS.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="#111">
          <path d={`M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
          <rect x={x + 2} y={y + 2} width={3} height={3} />
        </g>
      ))}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />
      ))}
    </svg>
  );
}

/** Court diary: hearings and consultations for the coming days. */
export function CourtDiaryPanel({ ui, urdu, animate = false }: { ui: TourUi; urdu?: string; animate?: boolean }) {
  const rows: Array<{ day: string; time: string; hearing: boolean; what: string; ref: string }> = [
    { day: 'Tue 29', time: '09:00', hearing: true, what: 'Bail · Cantt courts, Lahore', ref: 'WK-1042' },
    { day: 'Tue 29', time: '11:30', hearing: false, what: 'Farah Raza · property', ref: 'WK-1046' },
    { day: 'Thu 31', time: '10:00', hearing: true, what: 'Civil revision · LHC', ref: 'WK-1011' },
    { day: 'Mon 04', time: '12:00', hearing: true, what: 'Family court · Model Town', ref: 'WK-1029' },
  ];
  return (
    <Panel title={<span className={urdu}>{ui.courtDiary}</span>}>
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <Beat key={r.ref} as="li" at={200 + i * 380} still={!animate} className="flex items-center gap-2.5">
            <span dir="ltr" className="w-12 shrink-0 font-mono text-[10.5px] leading-tight text-muted-foreground">
              {r.day}
              <br />
              {r.time}
            </span>
            <span className={cn('h-8 w-0.5 shrink-0 rounded-full', r.hearing ? 'bg-attention' : 'bg-primary')} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[10.5px] font-medium', r.hearing ? 'text-attention' : 'text-primary', urdu)}>
                {r.hearing ? ui.hearing : ui.consultation}
              </span>
              <span dir="ltr" className="block truncate text-[12.5px]">{r.what}</span>
            </span>
            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{r.ref}</span>
          </Beat>
        ))}
      </ul>
    </Panel>
  );
}

/** Front-desk analytics: funnel, AI share and acknowledgement time (illustrative). */
export function AnalyticsPanel({ ui, urdu, animate = false }: { ui: TourUi; urdu?: string; animate?: boolean }) {
  const funnel: Array<[string, number]> = [
    [ui.chats, 56],
    [ui.matters, 21],
    [ui.paid, 9],
  ];
  const max = funnel[0]?.[1] ?? 1;
  const daily = [4, 6, 5, 8, 7, 9, 6, 10, 8, 11, 9, 12, 10, 13];
  return (
    <Panel title={<span className={urdu}>{ui.last7}</span>} meta={<span className={urdu}>{ui.illustrative}</span>}>
      <div className="space-y-2.5">
        {funnel.map(([label, value], i) => (
          <div key={label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[12px]">
            <span className={cn('truncate text-muted-foreground', urdu)}>{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full bg-primary', animate && 'tour-bar')}
                style={{ width: `${Math.round((value / max) * 100)}%`, animationDelay: `${200 + i * 300}ms` }}
              />
            </span>
            <span className="text-end font-mono tabular-nums">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border">
        {[
          [ui.handledByAi, '73%'],
          [ui.avgAck, '6 min'],
        ].map(([label, value]) => (
          <div key={label} className="bg-card p-2.5">
            <p className={cn('truncate text-[10.5px] text-muted-foreground', urdu)}>{label}</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-12 items-end gap-1">
        {daily.map((h, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-sm bg-primary/70', animate && 'tour-rise')}
            style={{ height: `${h * 7.5}%`, animationDelay: `${900 + i * 50}ms` }}
          />
        ))}
      </div>
    </Panel>
  );
}

/** The firm's AI settings, as on Settings → AI & automation. */
export function AiControlsPanel({ copy, urdu }: { copy: LandingCopy['features']['controls']; urdu?: string }) {
  const rows: Array<[string, string]> = [
    [copy.language, copy.languageValue],
    [copy.tone, copy.toneValue],
    [copy.length, copy.lengthValue],
    [copy.voice, copy.voiceValue],
  ];
  return (
    <Panel title={<span className={urdu}>{copy.title}</span>}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-[13px]">
        <span className={cn('font-medium', urdu)}>{copy.autoReply}</span>
        <span className="flex items-center gap-2">
          <span className={cn('text-[12px] text-primary', urdu)}>{copy.on}</span>
          <span className="relative h-5 w-9 rounded-full bg-primary">
            <span className="absolute end-0.5 top-0.5 size-4 rounded-full bg-primary-foreground" />
          </span>
        </span>
      </div>
      <dl className="mt-1 divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <dt className={cn('text-muted-foreground', urdu)}>{k}</dt>
            <dd className={cn('rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium', urdu)}>{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
