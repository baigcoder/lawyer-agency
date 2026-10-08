import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageCircleMore,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/translations';

/**
 * The one navigation model for the dashboard sidebar, mobile tab bar,
 * command menu and the /demo shell. Groups follow how a chamber works:
 * Command (today's work) → Operations → Finance → Chambers (administration).
 */
export type DashboardView =
  | 'overview'
  | 'inbox'
  | 'escalations'
  | 'cases'
  | 'calendar'
  | 'documents'
  | 'knowledge'
  | 'whatsapp'
  | 'payments'
  | 'analytics'
  | 'team'
  | 'settings'
  | 'setup';

export interface DashboardNavItem {
  view: DashboardView;
  href: string;
  key: TranslationKey;
  icon: LucideIcon;
  badge?: 'inbox' | 'escalations';
  /** Shown in the mobile bottom bar (max 4; the rest live under "More"). */
  mobilePrimary?: boolean;
  permission?: string;
  anyOf?: string[];
}

export interface DashboardNavSection {
  key: TranslationKey;
  items: DashboardNavItem[];
}

export const dashboardNavSections: DashboardNavSection[] = [
  {
    key: 'groupCommand',
    items: [
      { view: 'overview', href: '/dashboard', key: 'overview', icon: LayoutDashboard, mobilePrimary: true, permission: 'firm-profile:read' },
      { view: 'inbox', href: '/dashboard/inbox', key: 'inbox', icon: Inbox, badge: 'inbox', mobilePrimary: true, permission: 'inbox:read' },
      { view: 'escalations', href: '/dashboard/escalations', key: 'escalations', icon: AlertTriangle, badge: 'escalations', mobilePrimary: true, permission: 'inbox:read' },
      { view: 'cases', href: '/dashboard/cases', key: 'cases', icon: FolderOpen, mobilePrimary: true, permission: 'cases:read' },
    ],
  },
  {
    key: 'groupOperations',
    items: [
      { view: 'calendar', href: '/dashboard/calendar', key: 'calendar', icon: CalendarDays, permission: 'appointments:read' },
      { view: 'documents', href: '/dashboard/documents', key: 'documents', icon: FileText, permission: 'cases:write' },
      { view: 'knowledge', href: '/dashboard/knowledge', key: 'knowledge', icon: BookOpen, permission: 'knowledge-base:read' },
      { view: 'whatsapp', href: '/dashboard/whatsapp', key: 'whatsapp', icon: MessageCircleMore, permission: 'whatsapp:read' },
    ],
  },
  {
    key: 'groupFinance',
    items: [
      { view: 'payments', href: '/dashboard/payments', key: 'payments', icon: Wallet, permission: 'payments:read' },
      { view: 'analytics', href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, permission: 'analytics:read' },
    ],
  },
  {
    key: 'groupChambers',
    items: [
      { view: 'team', href: '/dashboard/team', key: 'team', icon: Users, permission: 'users:read' },
      {
        view: 'settings',
        href: '/dashboard/settings',
        key: 'settings',
        icon: Settings,
        anyOf: ['users:manage', 'lawyers:write', 'notifications:write'],
      },
      { view: 'setup', href: '/dashboard/setup', key: 'setup', icon: ListChecks, permission: 'users:manage' },
    ],
  },
];

export const dashboardNavItems: DashboardNavItem[] = dashboardNavSections.flatMap((section) => section.items);

/** Longest-prefix match so /dashboard/cases/x highlights Cases, not Overview. */
export function viewForPath(pathname: string): DashboardView {
  const match = dashboardNavItems
    .filter((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.view ?? 'overview';
}
