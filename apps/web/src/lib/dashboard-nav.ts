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

export interface DashboardNavItem {
  href: string;
  key: TranslationKey;
  icon: LucideIcon;
  permission?: string;
  anyOf?: string[];
}

export interface DashboardNavSection {
  key: TranslationKey;
  items: DashboardNavItem[];
}

export const dashboardNavSections: DashboardNavSection[] = [
  {
    key: 'groupMain',
    items: [
      { href: '/dashboard', key: 'overview', icon: LayoutDashboard, permission: 'firm-profile:read' },
      { href: '/dashboard/inbox', key: 'inbox', icon: Inbox, permission: 'inbox:read' },
      { href: '/dashboard/escalations', key: 'escalations', icon: AlertTriangle, permission: 'inbox:read' },
    ],
  },
  {
    key: 'groupManage',
    items: [
      { href: '/dashboard/cases', key: 'cases', icon: FolderOpen, permission: 'cases:read' },
      { href: '/dashboard/documents', key: 'documents', icon: FileText, permission: 'cases:write' },
      { href: '/dashboard/knowledge', key: 'knowledge', icon: BookOpen, permission: 'knowledge-base:read' },
      { href: '/dashboard/calendar', key: 'calendar', icon: CalendarDays, permission: 'appointments:read' },
      { href: '/dashboard/team', key: 'team', icon: Users, permission: 'users:read' },
    ],
  },
  {
    key: 'groupFirm',
    items: [
      { href: '/dashboard/whatsapp', key: 'whatsapp', icon: MessageCircleMore, permission: 'whatsapp:read' },
      { href: '/dashboard/payments', key: 'payments', icon: Wallet, permission: 'payments:read' },
      { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, permission: 'analytics:read' },
      {
        href: '/dashboard/settings',
        key: 'settings',
        icon: Settings,
        anyOf: ['users:manage', 'lawyers:write', 'notifications:write'],
      },
    ],
  },
  {
    key: 'groupSystem',
    items: [{ href: '/dashboard/setup', key: 'setup', icon: ListChecks, permission: 'users:manage' }],
  },
];

export const dashboardNavItems: DashboardNavItem[] = dashboardNavSections.flatMap((section) => section.items);
