'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InboxUnreadBadge } from '@/components/inbox/inbox-unread-badge';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { dashboardNavItems } from '@/lib/dashboard-nav';
import { useInboxUnreadCount } from '@/lib/inbox-unread';
import { useLanguage } from '@/lib/language';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t, dir } = useLanguage();
  const { session } = useSession();
  const inboxUnread = useInboxUnreadCount();
  const items = dashboardNavItems.filter((item) =>
    item.anyOf
      ? hasAnyPermission(session?.permissions, item.anyOf)
      : item.permission
        ? hasPermission(session?.permissions, item.permission)
        : true,
  );

  return (
    <div className={className}>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Open menu">
            <Menu className="h-5 w-5" />
            {inboxUnread > 0 ? (
              <span
                className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                aria-hidden
              />
            ) : null}
          </Button>
        }
      />
      <DialogContent className="w-72 p-0" aria-describedby={undefined}>
        <DialogHeader className="sr-only">
          <DialogTitle>Dashboard menu</DialogTitle>
        </DialogHeader>
        <nav aria-label="Dashboard mobile">
          <ul className="flex flex-col py-2">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} aria-hidden />
                    <span className={cn('flex-1', dir === 'rtl' && 'font-urdu')}>{t(item.key)}</span>
                    {item.href === '/dashboard/inbox' ? <InboxUnreadBadge /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
