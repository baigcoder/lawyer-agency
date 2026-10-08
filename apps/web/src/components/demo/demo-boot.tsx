'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIRM } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';
import { playUiSound } from '@/lib/ui-sound';
import { cn } from '@/lib/utils';

const CHECKS: TranslationKey[] = ['demoBoot1', 'demoBoot2', 'demoBoot3', 'demoBoot4'];
const CHECK_MS = 380;

/**
 * Demo opening: the chambers doors. The click on "Enter" is the user gesture
 * browsers require before audio, so the boot chord can play. Four real
 * system checks tick in, then the overlay lifts to reveal the workspace.
 * Reduced motion: no sequence, the workspace opens immediately.
 */
export function DemoBoot({
  sound,
  onSoundChange,
  onDone,
}: {
  sound: boolean;
  onSoundChange: (on: boolean) => void;
  onDone: () => void;
}) {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const [phase, setPhase] = useState<'gate' | 'checks' | 'leaving'>('gate');
  const [checked, setChecked] = useState(0);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    enterRef.current?.focus();
  }, []);

  useEffect(() => {
    if (phase !== 'checks') return;
    if (checked < CHECKS.length) {
      const id = window.setTimeout(() => {
        setChecked((c) => c + 1);
        if (sound) playUiSound('tick');
      }, CHECK_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setPhase('leaving'), 420);
    return () => window.clearTimeout(id);
  }, [phase, checked, sound]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const id = window.setTimeout(onDone, 650);
    return () => window.clearTimeout(id);
  }, [phase, onDone]);

  const enter = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone();
      return;
    }
    if (sound) playUiSound('boot');
    setPhase('checks');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-boot-title"
      className={cn(
        'chambers-stage dark fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-6 py-10 text-foreground',
        phase === 'leaving' && 'boot-leave',
      )}
      dir={dir}
    >
      <div className="w-full max-w-md text-center">
        <svg viewBox="0 0 64 64" className="mx-auto size-20" aria-hidden>
          <circle cx="32" cy="32" r="30" className="seal-ring" fill="none" stroke="currentColor" strokeOpacity="0.18" />
          <circle cx="32" cy="32" r="23" fill="var(--primary)" fillOpacity="0.12" stroke="var(--primary)" strokeOpacity="0.45" />
          <path
            d="M20 23L25 40.5L32 28L39 40.5L44 23"
            className="seal-draw"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="docket mt-8 text-primary">{t('demoTitle')}</p>
        <h1 id="demo-boot-title" className={cn('mt-3', urdu ? 'font-urdu text-3xl leading-[1.7]' : 'font-display text-[2.75rem] leading-[1.05]')}>
          {FIRM.name}
        </h1>
        <p className={cn('mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground', urdu)}>{t('demoBootLede')}</p>

        {phase === 'gate' ? (
          <div className="reveal-in mt-10 flex flex-col items-center gap-4">
            <Button ref={enterRef} size="lg" className="h-12 px-7 text-[0.95rem]" onClick={enter}>
              <span className={urdu}>{t('demoEnter')}</span>
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Button>
            <button
              type="button"
              onClick={() => onSoundChange(!sound)}
              aria-pressed={sound}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {sound ? <Volume2 className="size-3.5" aria-hidden /> : <VolumeX className="size-3.5" aria-hidden />}
              <span className={urdu}>{sound ? t('demoSoundOn') : t('demoSoundOff')}</span>
            </button>
          </div>
        ) : (
          <ol className="mx-auto mt-10 max-w-xs space-y-2.5 text-start" aria-live="polite">
            {CHECKS.map((key, i) => (
              <li
                key={key}
                data-on={i < checked}
                className="reveal flex items-center gap-2.5"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="size-3" aria-hidden />
                </span>
                <span className="docket text-foreground/85">{t(key)}</span>
              </li>
            ))}
          </ol>
        )}

        <p className={cn('mt-12 text-xs text-muted-foreground', urdu)}>
          {t('illustrativeDemo')}{' '}
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            {t('demoBack')}
          </Link>
        </p>
      </div>
    </div>
  );
}
