'use client';

import { Scale } from 'lucide-react';
import { usePathname } from 'next/navigation';
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
import { ProvisioningGuard } from './provisioning-guard';
import { RouteGuard } from '@/components/route-guard';
import { SessionGate } from '@/components/session-gate';
import { SessionProvider } from '@/lib/session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t, dir } = useLanguage();
  const pathname = usePathname();
  const inboxMode = pathname === '/dashboard/inbox';

  const chrome = (
    <SessionProvider>
      <SessionGate>
        <div className={cn('flex min-h-svh bg-background', inboxMode && 'h-svh overflow-hidden')} dir={dir}>
          <InboxAlertWatcher />
          <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
            <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Scale className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">Wakeel</span>
              <span className={cn('text-xs text-muted-foreground', dir === 'rtl' && 'font-urdu')}>
                {t('dashboard')}
              </span>
            </div>
            <DashboardNav />
            <div className="mt-auto border-t border-sidebar-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t('language')}</p>
                <LanguageToggle />
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
            <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center gap-2">
                <MobileNav />
                <p className="text-sm font-semibold tracking-tight">Wakeel</p>
              </div>
              <div className="flex items-center gap-1.5">
                <HeaderWhatsappStatus />
                <LanguageToggle />
                <ThemeToggle />
                <UserMenu />
              </div>
            </header>
            )}
            <main
              className={cn(
                'flex-1',
                inboxMode ? 'flex min-h-0 flex-col overflow-hidden' : 'px-4 py-6 sm:px-6 lg:px-8',
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
