'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DemoContext, type DemoContextValue } from '@/components/demo/demo-context';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { DemoBoot } from '@/components/demo/demo-boot';
import { DemoView } from '@/components/demo/views';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { AppSidebar, NavCount } from '@/components/shell/app-sidebar';
import { MobileTabBar } from '@/components/shell/mobile-tab-bar';
import { Signal } from '@/components/signal';
import { WakeelMonogram } from '@/components/wakeel-monogram';
import { PersonAvatar } from '@/components/workspace/panel';
import { dashboardNavSections, type DashboardView } from '@/lib/dashboard-nav';
import {
  ACTIVITY,
  CONVERSATIONS,
  ESCALATIONS,
  FIRM,
  INCOMING,
  INCOMING_URGENT,
  LIVE_ESCALATION,
  PAYMENTS,
  formatPkr,
  type DemoActivity,
  type DemoConversation,
  type DemoEscalation,
  type DemoMessage,
  type DemoPayment,
} from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { playUiSound, type UiSound } from '@/lib/ui-sound';
import { cn } from '@/lib/utils';

const SOUND_KEY = 'wakeel-demo-sound';
const BOOT_KEY = 'wakeel-demo-booted';

function noopSubscribe() {
  return () => {};
}

/** The opening plays once per browser session; a reload goes straight in. */
function readBootedBefore(): boolean {
  try {
    return window.sessionStorage.getItem(BOOT_KEY) === '1';
  } catch {
    return false;
  }
}

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * /demo — the product itself, running on illustrative data. Same shell,
 * navigation model, signals and components as the dashboard; interactions
 * (approve a draft, claim an escalation, verify a payment) change demo state
 * and are confirmed with sound + toast exactly as the product would.
 */
export function DemoApp() {
  const { t, dir } = useLanguage();
  const bootedBefore = useSyncExternalStore(noopSubscribe, readBootedBefore, () => false);
  const storedSound = useSyncExternalStore(noopSubscribe, readSoundPref, () => true);
  const [bootedNow, setBootedNow] = useState(false);
  const [soundChoice, setSoundChoice] = useState<boolean | null>(null);
  const booted = bootedNow || bootedBefore;
  const sound = soundChoice ?? storedSound;
  const [view, setView] = useState<DashboardView>('overview');
  const [conversations, setConversations] = useState<DemoConversation[]>(CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [escalations, setEscalations] = useState<DemoEscalation[]>(() =>
    ESCALATIONS.map((e) => ({ ...e, deadline: Date.now() + e.slaSeconds * 1000 })),
  );
  const [selectedEscalation, setSelectedEscalation] = useState<string>(ESCALATIONS[0]?.id ?? '');
  const [payments, setPayments] = useState<DemoPayment[]>(PAYMENTS);
  const [focusCase, setFocusCase] = useState<string | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [typing, setTyping] = useState<DemoContextValue['typing']>(null);
  const [activity, setActivity] = useState<DemoActivity[]>(ACTIVITY);

  const finishBoot = useCallback(() => {
    setBootedNow(true);
    try {
      window.sessionStorage.setItem(BOOT_KEY, '1');
    } catch {
      // storage blocked: the opening simply plays again next time
    }
  }, []);

  const setSound = useCallback((on: boolean) => {
    setSoundChoice(on);
    try {
      window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // preference simply won't persist
    }
  }, []);

  const play = useCallback((cue: UiSound) => {
    if (sound) playUiSound(cue);
  }, [sound]);

  const go = useCallback<DemoContextValue['go']>((next, opts) => {
    setView(next);
    if (opts?.conversation) setSelectedConversation(opts.conversation);
    if (opts?.caseRef) setFocusCase(opts.caseRef);
    if (opts?.escalation) setSelectedEscalation(opts.escalation);
    window.scrollTo({ top: 0 });
  }, []);

  // Live: a scripted few minutes of a real chamber — enquiries arrive and are
  // typed back to, a matter opens, a deadline escalates, a fee proof lands and
  // a colleague claims work. Every beat guards on current state, so a visitor
  // acting first (approving, claiming, verifying) is never overwritten.
  const escalationsRef = useRef(escalations);
  useEffect(() => {
    escalationsRef.current = escalations;
  }, [escalations]);

  useEffect(() => {
    if (!booted) return;
    const log = (what: string, who: string, source: string) =>
      setActivity((list) => [{ id: `live-${list.length}`, time: 'now', what, who, source }, ...list]);
    /** Update one conversation and float it to the top, like WhatsApp. */
    const bump = (id: string, fn: (c: DemoConversation) => DemoConversation) =>
      setConversations((list) => {
        const c = list.find((x) => x.id === id);
        return c ? [fn(c), ...list.filter((x) => x.id !== id)] : list;
      });
    const inbound = (id: string, message: DemoMessage, preview: string) =>
      bump(id, (c) => ({ ...c, unread: c.unread + 1, time: 'now', preview, messages: [...c.messages, message] }));

    const beats: Array<[number, () => void]> = [
      [8000, () => {
        setConversations((list) => (list.some((c) => c.id === INCOMING.id) ? list : [INCOMING, ...list]));
        setArrivedId(INCOMING.id);
        play('message');
        toast(t('demoToastNewTitle'), {
          description: `${INCOMING.client} · ${INCOMING.matter}`,
          action: { label: t('demoOpen'), onClick: () => go('inbox', { conversation: INCOMING.id }) },
        });
      }],
      [9600, () => setTyping({ id: INCOMING.id, who: 'ai' })],
      [12000, () => {
        setTyping(null);
        bump(INCOMING.id, (c) => ({
          ...c,
          preview: 'Ji, hum Family Court Lahore mein khula ke maamlaat lete hain…',
          messages: [...c.messages, {
            id: 'z2', from: 'ai', time: 'now', meta: 'Approved intake question',
            body: 'Assalam o alaikum. Main Al-Madad Law ka AI intake assistant hoon — qanooni mashwara nahi deta. Ji, hum Family Court Lahore mein khula ke maamlaat lete hain. Aap ka naam aur shehar bata dein, main aap ki baat Hira Saleem sahiba tak pohancha deta hoon.',
          }],
        }));
        log('Answered khula enquiry, asked name & city', INCOMING.client, 'FAQ · Family');
      }],
      [15500, () => setTyping({ id: INCOMING.id, who: 'client' })],
      [19000, () => {
        setTyping(null);
        inbound(INCOMING.id, { id: 'z3', from: 'client', time: 'now', body: 'Zainab Malik, Lahore. Shaadi ko 5 saal ho gaye, 2 bachay hain. Husband 8 mahine se kharcha nahi de raha.' }, 'Zainab Malik, Lahore. Shaadi ko 5 saal ho gaye…');
        play('message');
      }],
      [21500, () => {
        bump(INCOMING.id, (c) => ({
          ...c,
          state: 'HUMAN_REQUIRED',
          caseRef: 'WK-1049',
          assignee: 'Hira Saleem',
          messages: [...c.messages, { id: 'z4', from: 'system', time: 'now', body: 'Matter WK-1049 opened · facts extracted · assigned to Hira Saleem' }],
          draft: 'Shukriya Zainab sahiba. Aap ka maamla WK-1049 ke tor par darj ho gaya hai aur Hira Saleem sahiba ise dekh rahi hain. Baraye meharbani nikah nama ki copy aur apna CNIC yahan bhej dein.',
        }));
        log('Opened WK-1049, drafted document request for approval', INCOMING.client, 'Intake');
        play('tick');
        toast(t('demoToastDraftTitle'), {
          description: `${INCOMING.client} · WK-1049 · Hira Saleem`,
          action: { label: t('demoOpen'), onClick: () => go('inbox', { conversation: INCOMING.id }) },
        });
      }],
      [28000, () => {
        inbound('c-ahmed', { id: 'a6', from: 'client', kind: 'document', time: 'now', body: 'FIR ki copy bhej di hai.', meta: 'FIR_412-26_PS_Gulberg.pdf · T3 · kept in-house' }, 'FIR ki copy bhej di hai.');
        play('message');
        log('Filed FIR copy to WK-1042 — read in-house, not sent to third-party AI', 'Ahmed Raza', 'Document · T3');
        toast(t('demoToastDocTitle'), {
          description: 'Ahmed Raza · WK-1042 · FIR copy',
          action: { label: t('demoOpen'), onClick: () => go('inbox', { conversation: 'c-ahmed' }) },
        });
      }],
      [36000, () => {
        setConversations((list) => (list.some((c) => c.id === INCOMING_URGENT.id) ? list : [INCOMING_URGENT, ...list]));
        setEscalations((list) => (list.some((e) => e.id === LIVE_ESCALATION.id) ? list : [{ ...LIVE_ESCALATION, deadline: Date.now() + LIVE_ESCALATION.slaSeconds * 1000 }, ...list]));
        setArrivedId(INCOMING_URGENT.id);
        play('alert');
        log('Stopped automation — deadline tomorrow 10:00', INCOMING_URGENT.client, 'Safety rule');
        toast.error(t('demoToastEscTitle'), {
          description: `${INCOMING_URGENT.client} · ${t('escTriggerIMMINENT_DEADLINE')} · SLA 15:00`,
          action: { label: t('demoOpen'), onClick: () => go('escalations', { escalation: LIVE_ESCALATION.id }) },
        });
      }],
      [45000, () => {
        inbound('c-farah', { id: 'f3', from: 'client', kind: 'image', time: 'now', body: 'Doosri qist JazzCash se bhej di hai.', meta: 'jazzcash_receipt.jpg' }, 'Doosri qist JazzCash se bhej di hai.');
        setPayments((list) => list.map((p) => (p.id === 'p4' && p.status === 'REQUESTED' ? { ...p, status: 'PENDING', overdue: false, date: 'now' } : p)));
        play('message');
        log('Matched JazzCash receipt to WK-1046 instalment', 'Farah Raza', 'Payments');
        toast(t('demoToastProofTitle'), {
          description: `Farah Raza · ${formatPkr(30000)} · JazzCash`,
          action: { label: t('demoOpen'), onClick: () => go('payments') },
        });
      }],
      [53000, () => {
        // A colleague claims it — unless the visitor already did.
        if (escalationsRef.current.find((e) => e.id === 'e2')?.status !== 'OPEN') return;
        setEscalations((list) => list.map((e) => (e.id === 'e2' ? { ...e, status: 'ACKNOWLEDGED', assignee: 'Usman Tariq' } : e)));
        play('tick');
        log('Usman Tariq claimed the escalation — client told a lawyer is on it', 'Bilal Hussain', 'Team');
        toast(`Usman Tariq ${t('demoToastTeamClaim')}`, { description: 'Bilal Hussain · WK-1037' });
      }],
      [60000, () => log('Sent hearing reminder for Tue 14 Oct, 10:00', 'Farah Raza', 'Template · hearing_reminder')],
    ];
    const timers = beats.map(([at, run]) => window.setTimeout(run, at));
    return () => timers.forEach((id) => window.clearTimeout(id));
    // Run once per boot; `play`/`t`/`go` changes must not restart the script.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const approveDraft = useCallback((id: string, text: string) => {
    setConversations((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              draft: undefined,
              preview: text,
              messages: [...c.messages, { id: `${id}-sent-${c.messages.length}`, from: 'lawyer', author: 'Ayesha Khan', body: text, time: 'now', meta: 'Approved AI draft' }],
            }
          : c,
      ),
    );
    play('approve');
    toast.success(t('demoToastSent'), { description: t('demoToastSentDesc') });
  }, [play, t]);

  const sendMessage = useCallback((id: string, text: string, asNote: boolean) => {
    setConversations((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              unread: 0,
              preview: asNote ? c.preview : text,
              messages: [...c.messages, { id: `${id}-m-${c.messages.length}`, from: asNote ? 'note' : 'lawyer', author: 'Saad Qureshi', body: text, time: 'now' }],
            }
          : c,
      ),
    );
    play(asNote ? 'tick' : 'approve');
  }, [play]);

  const markRead = useCallback((id: string) => {
    setConversations((list) => list.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)));
  }, []);

  const acknowledge = useCallback((id: string) => {
    setEscalations((list) => list.map((e) => (e.id === id ? { ...e, status: 'ACKNOWLEDGED', assignee: e.assignee ?? 'Saad Qureshi' } : e)));
    play('approve');
    toast.success(t('demoToastClaimed'));
  }, [play, t]);

  const resolve = useCallback((id: string) => {
    setEscalations((list) => list.map((e) => (e.id === id ? { ...e, status: 'RESOLVED' } : e)));
    play('tick');
  }, [play]);

  const verifyPayment = useCallback((id: string) => {
    setPayments((list) => list.map((p) => (p.id === id ? { ...p, status: 'SUCCEEDED', date: 'now' } : p)));
    play('approve');
    toast.success(t('demoToastVerified'));
  }, [play, t]);

  const unread = conversations.reduce((n, c) => n + c.unread, 0);
  const openEscalations = escalations.filter((e) => e.status === 'OPEN').length;
  const badges = {
    inbox: <NavCount count={unread} />,
    escalations: <NavCount count={openEscalations} tone="critical" />,
  };

  const value = useMemo<DemoContextValue>(
    () => ({
      view,
      go,
      conversations,
      selectedConversation,
      setSelectedConversation,
      markRead,
      approveDraft,
      sendMessage,
      escalations,
      selectedEscalation,
      setSelectedEscalation,
      acknowledge,
      resolve,
      payments,
      verifyPayment,
      focusCase,
      setFocusCase,
      play,
      arrivedId,
      typing,
      activity,
    }),
    [view, go, conversations, selectedConversation, markRead, approveDraft, sendMessage, escalations, selectedEscalation, acknowledge, resolve, payments, verifyPayment, focusCase, play, arrivedId, typing, activity],
  );

  const soundToggle = (
    <button
      type="button"
      onClick={() => {
        setSound(!sound);
        if (!sound) playUiSound('tick');
      }}
      aria-pressed={sound}
      aria-label={sound ? t('demoSoundOn') : t('demoSoundOff')}
      title={sound ? t('demoSoundOn') : t('demoSoundOff')}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
    </button>
  );

  return (
    <DemoContext.Provider value={value}>
      {!booted ? <DemoBoot sound={sound} onSoundChange={setSound} onDone={finishBoot} /> : null}

      <div className="flex min-h-svh flex-col bg-background" dir={dir} aria-hidden={!booted || undefined}>
        <div className="flex h-9 items-center justify-center gap-3 border-b border-border bg-sunken px-4 text-xs">
          <span className="docket truncate text-muted-foreground">{t('demoRibbon')}</span>
          <Link href="/sign-up" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline">
            {t('startPilot')}
            <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
          </Link>
        </div>

        <div className="flex min-h-0 flex-1">
          <AppSidebar
            className="sticky top-0 hidden h-svh lg:flex"
            sections={dashboardNavSections}
            active={view}
            firmName={FIRM.name}
            subtitle={`${FIRM.city} · ${t('demoWorkspace')}`}
            badges={badges}
            onSelect={(next) => go(next)}
            onSearch={() => toast(t('demoCommandHint'))}
            footer={
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Signal level="ok">WhatsApp · {t('demoConnected')}</Signal>
                </div>
                <p className="docket text-muted-foreground">RLS · T3 {t('demoProtected')}</p>
              </div>
            }
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/88 px-4 backdrop-blur-md sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
                <WakeelMonogram className="h-7 w-7" />
                <span className="truncate text-sm font-semibold">{FIRM.name}</span>
              </div>
              <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 lg:flex">
                <span className="docket text-muted-foreground">{FIRM.name}</span>
                <span className="text-muted-foreground/50" aria-hidden>/</span>
                <span className={cn('truncate text-[13px] font-medium', dir === 'rtl' && 'font-urdu')}>{t(view)}</span>
              </nav>
              <div className="ms-auto flex items-center gap-1">
                <span className="me-2 hidden items-center gap-2 rounded-full bg-primary/8 px-2.5 py-1 ring-1 ring-primary/20 md:flex">
                  <span className="live-ping size-1.5 rounded-full bg-primary" aria-hidden />
                  <span className="font-mono text-[11px] tabular-nums text-foreground/80">{FIRM.whatsapp}</span>
                </span>
                {soundToggle}
                <LanguageToggle />
                <ThemeToggle />
                <span className="ms-1.5 hidden items-center gap-2 sm:flex">
                  <PersonAvatar initials="SQ" firm />
                </span>
              </div>
            </header>

            <main id="main" className={cn('min-w-0 flex-1', view !== 'inbox' && 'pb-20 lg:pb-0')}>
              {booted ? <DemoView key={view} /> : null}
            </main>
          </div>
        </div>

        <MobileTabBar
          sections={dashboardNavSections}
          active={view}
          badges={badges}
          onSelect={(next) => go(next)}
          sheetFooter={<div className="flex items-center gap-2">{soundToggle}<LanguageToggle /><ThemeToggle /></div>}
        />
      </div>
    </DemoContext.Provider>
  );
}

