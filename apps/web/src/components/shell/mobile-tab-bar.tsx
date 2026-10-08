'use client';

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { MoreHorizontal, X } from 'lucide-react';
import type { DashboardNavItem, DashboardNavSection, DashboardView } from '@/lib/dashboard-nav';
import type { NavBadges } from '@/components/shell/app-sidebar';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/**
 * Mobile navigation: a native-feeling bottom tab bar (four primary
 * destinations + More). "More" opens a bottom sheet built on the native
 * <dialog> element — focus trap, Escape and inert background for free.
 */
export function MobileTabBar({
  sections,
  active,
  badges,
  onSelect,
  sheetFooter,
}: {
  sections: DashboardNavSection[];
  active: DashboardView;
  badges?: NavBadges;
  onSelect?: (view: DashboardView) => void;
  sheetFooter?: ReactNode;
}) {
  const { t, dir } = useLanguage();
  const sheet = useRef<HTMLDialogElement>(null);
  const all = sections.flatMap((s) => s.items);
  const primary = all.filter((i) => i.mobilePrimary).slice(0, 4);
  const moreActive = !primary.some((i) => i.view === active);
  const close = () => sheet.current?.close();

  const tab = (item: DashboardNavItem) => {
    const isActive = item.view === active;
    const Icon = item.icon;
    const badge = item.badge ? badges?.[item.badge] : null;
    const inner = (
      <>
        <span className="relative">
          <Icon className={cn('size-5', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
          {badge ? <span className="absolute -end-3 -top-2 scale-90">{badge}</span> : null}
        </span>
        <span className={cn('text-[11px] leading-none', isActive ? 'font-medium text-foreground' : 'text-muted-foreground', dir === 'rtl' && 'font-urdu leading-[1.6]')}>
          {t(item.key)}
        </span>
        <span aria-hidden className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
      </>
    );
    const cls = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';
    return onSelect ? (
      <button key={item.view} type="button" className={cls} aria-current={isActive ? 'page' : undefined} onClick={() => onSelect(item.view)}>
        {inner}
      </button>
    ) : (
      <Link key={item.view} href={item.href} className={cls} aria-current={isActive ? 'page' : undefined}>
        {inner}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label={t('mainNavigation')}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {primary.map(tab)}
        <button
          type="button"
          className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          aria-haspopup="dialog"
          onClick={() => sheet.current?.showModal()}
        >
          <MoreHorizontal className={cn('size-5', moreActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
          <span className={cn('text-[11px] leading-none', moreActive ? 'font-medium text-foreground' : 'text-muted-foreground', dir === 'rtl' && 'font-urdu leading-[1.6]')}>
            {t('more')}
          </span>
          <span aria-hidden className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-primary', moreActive ? 'opacity-100' : 'opacity-0')} />
        </button>
      </nav>

      <dialog
        ref={sheet}
        aria-label={t('mainNavigation')}
        onClick={(event) => {
          if (event.target === sheet.current) close();
        }}
        className="sheet m-0 mt-auto max-h-[85svh] w-full max-w-none rounded-t-2xl bg-background p-0 text-foreground shadow-2xl ring-1 ring-border backdrop:bg-black/45 backdrop:backdrop-blur-[2px] lg:hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span aria-hidden className="absolute start-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <p className="docket text-muted-foreground">{t('mainNavigation')}</p>
          <button type="button" onClick={close} className="flex size-9 items-center justify-center rounded-md hover:bg-muted" aria-label={t('close')}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.key}>
              <p className="docket mb-1 px-2 text-muted-foreground">{t(section.key)}</p>
              <ul className="grid grid-cols-2 gap-1">
                {section.items.map((item) => {
                  const isActive = item.view === active;
                  const cls = cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm',
                    isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
                  );
                  const body = (
                    <>
                      <item.icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                      <span className={cn('flex-1 truncate text-start', dir === 'rtl' && 'font-urdu')}>{t(item.key)}</span>
                      {item.badge ? badges?.[item.badge] : null}
                    </>
                  );
                  return (
                    <li key={item.view}>
                      {onSelect ? (
                        <button type="button" className={cls} aria-current={isActive ? 'page' : undefined} onClick={() => { onSelect(item.view); close(); }}>
                          {body}
                        </button>
                      ) : (
                        <Link href={item.href} className={cls} aria-current={isActive ? 'page' : undefined} onClick={close}>
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {sheetFooter ? <div className="border-t border-border px-4 py-3">{sheetFooter}</div> : null}
      </dialog>
    </>
  );
}
