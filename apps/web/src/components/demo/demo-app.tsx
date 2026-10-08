'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
  CONVERSATIONS,
  ESCALATIONS,
  FIRM,
  INCOMING,
  PAYMENTS,
  type DemoConversation,
  type DemoEscalation,
  type DemoPayment,
} from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import { playUiSound, type UiSound } from '@/lib/ui-sound';
import { cn } from '@/lib/utils';

const SOUND_KEY = 'wakeel-demo-sound';
const BOOT_KEY = 'wakeel-demo-booted';
const INCOMING_AFTER_MS = 9000;
const AUTO_REPLY_AFTER_MS = 3500;

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

  // Live: a new WhatsApp enquiry arrives, then Wakeel answers it.
  useEffect(() => {
    if (!booted) return;
    const arrive = window.setTimeout(() => {
      setConversations((list) => (list.some((c) => c.id === INCOMING.id) ? list : [INCOMING, ...list]));
      setArrivedId(INCOMING.id);
      play('message');
      toast(t('demoToastNewTitle'), {
        description: `${INCOMING.client} · ${INCOMING.matter}`,
        action: { label: t('demoOpen'), onClick: () => go('inbox', { conversation: INCOMING.id }) },
      });
    }, INCOMING_AFTER_MS);
    const reply = window.setTimeout(() => {
      setConversations((list) =>
        list.map((c) =>
          c.id === INCOMING.id && c.messages.length === 1
            ? {
                ...c,
                preview: 'Ji, hum Family Court Lahore mein khula ke maamlaat lete hain…',
                messages: [
                  ...c.messages,
                  {
                    id: 'z2',
                    from: 'ai',
                    time: 'now',
                    meta: 'Approved intake question',
                    body: 'Assalam o alaikum. Main Al-Madad Law ka AI intake assistant hoon — qanooni mashwara nahi deta. Ji, hum Family Court Lahore mein khula ke maamlaat lete hain. Aap ka naam aur shehar bata dein, main aap ki baat Hira Saleem sahiba tak pohancha deta hoon.',
                  },
                ],
              }
            : c,
        ),
      );
    }, INCOMING_AFTER_MS + AUTO_REPLY_AFTER_MS);
    return () => {
      window.clearTimeout(arrive);
      window.clearTimeout(reply);
    };
    // Run once per boot; `play`/`t` changes must not re-trigger the arrival.
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
    }),
    [view, go, conversations, selectedConversation, markRead, approveDraft, sendMessage, escalations, selectedEscalation, acknowledge, resolve, payments, verifyPayment, focusCase, play, arrivedId],
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

