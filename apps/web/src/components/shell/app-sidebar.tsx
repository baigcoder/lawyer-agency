'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { WakeelMonogram } from '@/components/wakeel-monogram';
import type { DashboardNavItem, DashboardNavSection, DashboardView } from '@/lib/dashboard-nav';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export type NavBadges = Partial<Record<NonNullable<DashboardNavItem['badge']>, ReactNode>>;

/**
 * Wakeel sidebar — shared by the dashboard and /demo. Signature details:
 * docket section rules ("COMMAND ———"), a raised "folder tab" active state
 * with an emerald spine, and a chambers status footer. Items navigate by
 * `href` (dashboard) or `onSelect` (demo, which is a single page).
 */
export function AppSidebar({
  sections,
  active,
  firmName,
  subtitle,
  badges,
  onSelect,
  onSearch,
  footer,
  className,
}: {
  sections: DashboardNavSection[];
  active: DashboardView;
  firmName: string;
  subtitle?: string;
  badges?: NavBadges;
  onSelect?: (view: DashboardView) => void;
  onSearch?: () => void;
  footer?: ReactNode;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <aside className={cn('flex h-full w-[248px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar', className)}>
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <WakeelMonogram className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">{firmName}</p>
            {subtitle ? <p className="docket truncate text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {onSearch ? (
          <button
            type="button"
            onClick={onSearch}
            className="mt-4 flex h-8 w-full items-center gap-2 rounded-lg bg-background px-2.5 text-[12.5px] text-muted-foreground ring-1 ring-sidebar-border transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1 text-start">{t('jumpTo')}</span>
            <kbd className="font-mono text-[10.5px] text-muted-foreground/80">Ctrl K</kbd>
          </button>
        ) : null}
      </div>

      <nav aria-label={t('mainNavigation')} className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-4 pt-2">
        {sections.map((section) => (
          <div key={section.key}>
            <h2 className="docket mb-1.5 flex items-center gap-2 px-2 text-muted-foreground/80">
              {t(section.key)}
              <span aria-hidden className="h-px flex-1 bg-sidebar-border" />
            </h2>
            <ul className="space-y-px">
              {section.items.map((item) => (
                <li key={item.view}>
                  <SidebarItem
                    item={item}
                    active={item.view === active}
                    badge={item.badge ? badges?.[item.badge] : undefined}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {footer ? <div className="border-t border-sidebar-border px-3 py-3">{footer}</div> : null}
    </aside>
  );
}

function SidebarItem({
  item,
  active,
  badge,
  onSelect,
}: {
  item: DashboardNavItem;
  active: boolean;
  badge?: ReactNode;
  onSelect?: (view: DashboardView) => void;
}) {
  const { t, dir } = useLanguage();
  const Icon = item.icon;
  const classes = cn(
    'group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition-[background-color,color] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[0_1px_2px_oklch(0.2_0.02_70/0.06)] ring-1 ring-sidebar-border'
      : 'text-sidebar-foreground/75 hover:bg-foreground/[0.045] hover:text-sidebar-foreground',
  );
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1.5 start-0 w-[2px] rounded-full bg-primary transition-opacity duration-150',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon
        className={cn('size-4 shrink-0 transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
        aria-hidden
      />
      <span className={cn('flex-1 truncate text-start', dir === 'rtl' && 'font-urdu leading-none')}>{t(item.key)}</span>
      {badge}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item.view)} aria-current={active ? 'page' : undefined} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={classes}>
      {content}
    </Link>
  );
}

/** Count pill for sidebar/tab badges. `critical` renders red for escalations. */
export function NavCount({ count, tone = 'default' }: { count: number; tone?: 'default' | 'critical' }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] font-medium leading-5 tabular-nums',
        tone === 'critical' ? 'bg-critical text-white dark:text-[oklch(0.16_0.02_25)]' : 'bg-foreground/[0.07] text-foreground/80',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
