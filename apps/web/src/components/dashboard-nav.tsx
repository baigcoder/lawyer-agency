'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { InboxUnreadBadge } from '@/components/inbox/inbox-unread-badge';
import { useLanguage } from '@/lib/language';
import { dashboardNavSections } from '@/lib/dashboard-nav';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export function DashboardNav() {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const { session } = useSession();
  const permissions = session?.permissions;

  return (
    <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-2 py-3">
      {dashboardNavSections.map((section) => {
        const items = section.items.filter((item) =>
          item.anyOf
            ? hasAnyPermission(permissions, item.anyOf)
            : item.permission
              ? hasPermission(permissions, item.permission)
              : true,
        );
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="mb-4">
            <p
              className={cn(
                'mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70',
                dir === 'rtl' && 'font-urdu normal-case tracking-normal',
              )}
            >
              {t(section.key)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                        />
                      )}
                      <item.icon
                        className={cn('h-4 w-4 shrink-0', active && 'text-primary')}
                        aria-hidden
                      />
                      <span className={cn('flex-1', dir === 'rtl' && 'font-urdu text-right')}>
                        {t(item.key)}
                      </span>
                      {item.href === '/dashboard/inbox' ? <InboxUnreadBadge /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
