'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';
import { clerkEnabled } from '@/lib/env';
import { apiRequest } from '@/lib/api-client';
import { dashboardNavSections, viewForPath, type DashboardNavSection } from '@/lib/dashboard-nav';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import { firmProfileReadSchema } from '@/lib/schemas/firm-profile';
import { InboxAlertWatcher } from '@/components/inbox/inbox-alert-watcher';
import { InboxUnreadBadge } from '@/components/inbox/inbox-unread-badge';
import { EscalationBadge } from '@/components/escalations/escalation-badge';
import { HeaderWhatsappStatus } from '@/components/header-whatsapp-status';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { CommandMenu } from '@/components/command-menu';
import { WakeelMonogram } from '@/components/wakeel-monogram';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { MobileTabBar } from '@/components/shell/mobile-tab-bar';
import { Signal } from '@/components/signal';
import { ProvisioningGuard } from './provisioning-guard';
import { RouteGuard } from '@/components/route-guard';
import { SessionGate } from '@/components/session-gate';
import { SessionProvider, useSession } from '@/lib/session';

const badges = { inbox: <InboxUnreadBadge />, escalations: <EscalationBadge /> };

function openCommandMenu() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
}

/** Navigation filtered to what this role may open (also enforced server-side). */
function useVisibleSections(): DashboardNavSection[] {
  const { session } = useSession();
  const permissions = session?.permissions;
  return dashboardNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.anyOf
          ? hasAnyPermission(permissions, item.anyOf)
          : item.permission
            ? hasPermission(permissions, item.permission)
            : true,
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t, dir } = useLanguage();
  const pathname = usePathname();
  const { session } = useSession();
  const sections = useVisibleSections();
  const view = viewForPath(pathname);
  const inboxMode = pathname === '/dashboard/inbox';
  const profile = useQuery({
    queryKey: ['firm-profile'],
    queryFn: () => apiRequest('/v1/firm-profile', { schema: firmProfileReadSchema }),
    retry: false,
  });
  const firmName = profile.data?.displayName ?? profile.data?.firmName ?? t('yourFirm');
  const roleKey = session?.role === 'Owner' ? 'roleOwner' : session?.role === 'Lawyer' ? 'roleLawyer' : 'roleStaff';

  return (
    <div className={cn('flex min-h-svh bg-background', inboxMode && 'h-svh overflow-hidden')} dir={dir}>
      <InboxAlertWatcher />
      <CommandMenu />

      <AppSidebar
        className="sticky top-0 hidden h-svh lg:flex"
        sections={sections}
        active={view}
        firmName={firmName}
        subtitle={session ? `${session.name.split(/\s+/)[0]} · ${t(roleKey)}` : undefined}
        badges={badges}
        onSearch={openCommandMenu}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Signal level="ok">RLS · {t('setEnforced')}</Signal>
            <div className="flex items-center gap-0.5">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        }
      />

      <div className={cn('flex min-w-0 flex-1 flex-col', inboxMode && 'h-svh min-h-0 overflow-hidden')}>
        {inboxMode ? null : (
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/88 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <WakeelMonogram className="h-7 w-7" />
              <span className="truncate text-sm font-semibold">{firmName}</span>
            </div>
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 lg:flex">
              <span className="docket truncate text-muted-foreground">{firmName}</span>
              <span className="text-muted-foreground/50" aria-hidden>/</span>
              <span className={cn('truncate text-[13px] font-medium', dir === 'rtl' && 'font-urdu')}>{t(view)}</span>
            </nav>
            <div className="ms-auto flex items-center gap-1.5">
              <HeaderWhatsappStatus />
              <span className="lg:hidden">
                <LanguageToggle />
              </span>
              <span className="lg:hidden">
                <ThemeToggle />
              </span>
              <UserMenu />
            </div>
          </header>
        )}
        <main
          id="main"
          className={cn(
            'flex-1',
            inboxMode ? 'flex min-h-0 flex-col overflow-hidden max-lg:pb-14' : 'px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8',
          )}
        >
          <div className={cn(inboxMode ? 'flex min-h-0 flex-1 flex-col' : 'app-enter mx-auto w-full max-w-[1440px]')} key={inboxMode ? undefined : pathname}>
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>

      <MobileTabBar
        sections={sections}
        active={view}
        badges={badges}
        sheetFooter={
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        }
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const chrome = (
    <SessionProvider>
      <SessionGate>
        <Shell>{children}</Shell>
      </SessionGate>
    </SessionProvider>
  );

  if (clerkEnabled) return <ProvisioningGuard>{chrome}</ProvisioningGuard>;
  return chrome;
}
