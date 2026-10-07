'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  MessageCircleMore,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { InboxUnreadBadge } from '@/components/inbox/inbox-unread-badge';
import { EscalationBadge } from '@/components/escalations/escalation-badge';
import { useLanguage } from '@/lib/language';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/lib/translations';

interface NavItem {
  href: string;
  key: TranslationKey;
  icon: LucideIcon;
  badge?: 'inbox' | 'escalations';
  permission?: string;
  anyOf?: string[];
}

interface NavGroup {
  labelEn: string;
  labelUr: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelEn: 'Operations',
    labelUr: 'مرکزی کارروائی',
    items: [
      { href: '/dashboard', key: 'overview', icon: LayoutDashboard, permission: 'firm-profile:read' },
      { href: '/dashboard/inbox', key: 'inbox', icon: Inbox, badge: 'inbox', permission: 'inbox:read' },
      { href: '/dashboard/escalations', key: 'escalations', icon: AlertTriangle, badge: 'escalations', permission: 'inbox:read' },
    ],
  },
  {
    labelEn: 'Legal Work',
    labelUr: 'قانونی امور',
    items: [
      { href: '/dashboard/cases', key: 'cases', icon: FolderOpen, permission: 'cases:read' },
      { href: '/dashboard/calendar', key: 'calendar', icon: CalendarDays, permission: 'appointments:read' },
      { href: '/dashboard/documents', key: 'documents', icon: FileText, permission: 'cases:write' },
      { href: '/dashboard/knowledge', key: 'knowledge', icon: BookOpen, permission: 'knowledge-base:read' },
    ],
  },
  {
    labelEn: 'Channels & Finance',
    labelUr: 'رابطے و فیس',
    items: [
      { href: '/dashboard/whatsapp', key: 'whatsapp', icon: MessageCircleMore, permission: 'whatsapp:read' },
      { href: '/dashboard/payments', key: 'payments', icon: Wallet, permission: 'payments:read' },
      { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, permission: 'analytics:read' },
    ],
  },
  {
    labelEn: 'Chamber Admin',
    labelUr: 'انتظامی امور',
    items: [
      { href: '/dashboard/team', key: 'team', icon: Users, permission: 'users:read' },
      {
        href: '/dashboard/settings',
        key: 'settings',
        icon: Settings,
        anyOf: ['users:manage', 'lawyers:write', 'notifications:write'],
      },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { t, dir, language } = useLanguage();
  const { session } = useSession();
  const permissions = session?.permissions;

  return (
    <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4">
      {navGroups.map((group, gIdx) => {
        const visibleItems = group.items.filter((item) =>
          item.anyOf
            ? hasAnyPermission(permissions, item.anyOf)
            : item.permission
              ? hasPermission(permissions, item.permission)
              : true,
        );

        if (visibleItems.length === 0) return null;

        return (
          <div key={gIdx} className="space-y-1">
            <h2
              className={cn(
                'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none',
                dir === 'rtl' && 'font-urdu tracking-normal text-end',
              )}
            >
              {language === 'ur' ? group.labelUr : group.labelEn}
            </h2>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        active
                          ? 'bg-accent text-accent-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        )}
                        aria-hidden
                      />
                      <span className={cn('flex-1 truncate', dir === 'rtl' && 'font-urdu text-end')}>
                        {t(item.key)}
                      </span>
                      {item.badge === 'inbox' ? <InboxUnreadBadge /> : null}
                      {item.badge === 'escalations' ? <EscalationBadge /> : null}
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
