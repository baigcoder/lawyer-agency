'use client';

import { usePathname } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';
import { clerkEnabled } from '@/lib/env';
import { DashboardNav } from '@/components/dashboard-nav';
import { InboxAlertWatcher } from '@/components/inbox/inbox-alert-watcher';
import { HeaderWhatsappStatus } from '@/components/header-whatsapp-status';
import { MobileNav } from '@/components/mobile-nav';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { CommandMenu } from '@/components/command-menu';
import { WakeelMonogram } from '@/components/wakeel-monogram';
import { ProvisioningGuard } from './provisioning-guard';
import { RouteGuard } from '@/components/route-guard';
import { SessionGate } from '@/components/session-gate';
import { SessionProvider, useSession } from '@/lib/session';

function SidebarHeader() {
  const { t, dir } = useLanguage();
  const { session } = useSession();
  const roleName = session?.role ?? 'Advocate';

  return (
    <div className="flex flex-col gap-2 border-b border-sidebar-border px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-xs ring-1 ring-border/40">
            <WakeelMonogram className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-foreground truncate">Wakeel</span>
              <span className="inline-flex items-center rounded px-1 text-[10px] font-medium bg-primary/10 text-primary">
                PRO
              </span>
            </div>
            <p className={cn('text-[11px] text-muted-foreground truncate', dir === 'rtl' && 'font-urdu')}>
              {roleName} · {t('dashboard')}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">Quick jump...</span>
        </span>
        <kbd className="hidden sm:inline-flex items-center rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-2xs">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}

function TopBarBreadcrumbs() {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);
  const currentSection = segments[1] ?? 'overview';
  const sectionTitle = currentSection.charAt(0).toUpperCase() + currentSection.slice(1);

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-medium text-muted-foreground/80">Chamber</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-40 shrink-0" />
      <span className="font-semibold text-foreground">
        {sectionTitle}
      </span>
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dir } = useLanguage();
  const pathname = usePathname();
  const inboxMode = pathname === '/dashboard/inbox';

  const chrome = (
    <SessionProvider>
      <SessionGate>
        <div className={cn('flex min-h-svh bg-background', inboxMode && 'h-svh overflow-hidden')} dir={dir}>
          <InboxAlertWatcher />
          <CommandMenu />

          <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
            <SidebarHeader />
            <DashboardNav />
            <div className="mt-auto border-t border-sidebar-border p-2.5 bg-sidebar/50">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-muted-foreground">Live Telemetry</span>
                </div>
                <div className="flex items-center gap-1">
                  <LanguageToggle />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </aside>

          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col',
              inboxMode && 'h-svh min-h-0 overflow-hidden',
            )}
          >
            {inboxMode ? null : (
              <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
                <div className="flex items-center gap-3 min-w-0">
                  <MobileNav />
                  <TopBarBreadcrumbs />
                </div>
                <div className="flex items-center gap-2">
                  <HeaderWhatsappStatus />
                  <LanguageToggle />
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </header>
            )}
            <main
              id="main"
              className={cn(
                'flex-1',
                inboxMode ? 'flex min-h-0 flex-col overflow-hidden' : 'px-4 py-5 sm:px-6 lg:px-8',
              )}
            >
              <div
                className={cn(
                  inboxMode ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full max-w-[1440px]',
                )}
              >
                <RouteGuard>{children}</RouteGuard>
              </div>
            </main>
          </div>
        </div>
      </SessionGate>
    </SessionProvider>
  );

  if (clerkEnabled) return <ProvisioningGuard>{chrome}</ProvisioningGuard>;
  return chrome;
}
