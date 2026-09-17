'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, Scale, X } from 'lucide-react';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

const PANEL_ID = 'marketing-mobile-nav';
const TRIGGER_ID = 'marketing-mobile-nav-trigger';

/**
 * Public-site header. Extracted from the landing page so the mobile navigation
 * lives in one place: below `md` the in-page anchors and the Sign in link used
 * to be `hidden`, which left phone visitors with no way to reach any section.
 *
 * The mobile menu is a disclosure panel, not a modal — three same-page anchors
 * do not justify a focus trap, and `DialogContent` hard-codes centring that a
 * header-anchored panel would have to fight.
 */
export function MarketingHeader() {
  const { t, dir } = useLanguage();
  const [open, setOpen] = useState(false);
  const urdu = dir === 'rtl';

  const links = [
    { href: '#product', label: t('whatIsWakeel') },
    { href: '#how-it-works', label: t('howItWorks') },
    { href: '#features', label: t('features') },
    { href: '#voice', label: t('overviewAiVoice') },
    { href: '#security', label: t('security') },
  ];

  // Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      document.getElementById(TRIGGER_ID)?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Crossing into the desktop breakpoint must not leave the panel state stuck
  // open behind a `lg:hidden` trigger the user can no longer reach.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 64rem)');
    const sync = () => {
      if (query.matches) setOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Scale className="h-4.5 w-4.5 text-primary" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">Wakeel</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              className={cn(
                'rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground',
                urdu && 'font-urdu',
              )}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            {t('signIn')}
          </Button>
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link href="/sign-up" />}
          >
            {t('startPilot')}
          </Button>
          <Button
            id={TRIGGER_ID}
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={PANEL_ID}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </div>

      {/*
        `hidden` rather than opacity/height so the links leave the tab order
        entirely while collapsed.
      */}
      <div
        id={PANEL_ID}
        hidden={!open}
        className="border-t border-border bg-background lg:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    urdu && 'font-urdu',
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/sign-in" onClick={() => setOpen(false)} />}
            >
              {t('signIn')}
            </Button>
            <Button
              className="w-full sm:hidden"
              nativeButton={false}
              render={<Link href="/sign-up" onClick={() => setOpen(false)} />}
            >
              {t('startPilot')}
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
