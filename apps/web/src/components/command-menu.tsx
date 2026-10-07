'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Users,
  Wallet,
  Globe,
  MessageCircleMore,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
  section: 'navigation' | 'actions' | 'preferences';
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  const items: CommandItem[] = [
    {
      id: 'nav-overview',
      label: t('overview'),
      detail: 'Firm performance & operations',
      icon: LayoutDashboard,
      shortcut: 'G O',
      section: 'navigation',
      onSelect: () => router.push('/dashboard'),
    },
    {
      id: 'nav-inbox',
      label: t('inbox'),
      detail: 'WhatsApp client triage & chat',
      icon: Inbox,
      shortcut: 'G I',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/inbox'),
    },
    {
      id: 'nav-escalations',
      label: t('escalations'),
      detail: 'Urgent matters requiring lawyer claim',
      icon: AlertTriangle,
      shortcut: 'G E',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/escalations'),
    },
    {
      id: 'nav-cases',
      label: t('cases'),
      detail: 'Active client files & matters',
      icon: FolderOpen,
      shortcut: 'G C',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/cases'),
    },
    {
      id: 'nav-calendar',
      label: t('calendar'),
      detail: 'Court hearings & chamber consultations',
      icon: CalendarDays,
      shortcut: 'G A',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/calendar'),
    },
    {
      id: 'nav-documents',
      label: t('documents'),
      detail: 'FIRs, CNICs, court decrees & vault',
      icon: FileText,
      shortcut: 'G D',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/documents'),
    },
    {
      id: 'nav-payments',
      label: t('payments'),
      detail: 'JazzCash, Easypaisa & bank receipts',
      icon: Wallet,
      shortcut: 'G P',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/payments'),
    },
    {
      id: 'nav-whatsapp',
      label: t('whatsapp'),
      detail: 'Connection status & gateway settings',
      icon: MessageCircleMore,
      shortcut: 'G W',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/whatsapp'),
    },
    {
      id: 'nav-knowledge',
      label: t('knowledge'),
      detail: 'Firm fee tariffs & AI guidance FAQ',
      icon: BookOpen,
      shortcut: 'G K',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/knowledge'),
    },
    {
      id: 'nav-team',
      label: t('team'),
      detail: 'Advocate roster & staff roles',
      icon: Users,
      shortcut: 'G T',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/team'),
    },
    {
      id: 'nav-settings',
      label: t('settings'),
      detail: 'Firm profile & AI preferences',
      icon: Settings,
      shortcut: 'G S',
      section: 'navigation',
      onSelect: () => router.push('/dashboard/settings'),
    },
    {
      id: 'act-theme',
      label: 'Toggle Theme',
      detail: 'Switch between light and dark mode',
      icon: Moon,
      shortcut: 'T',
      section: 'preferences',
      onSelect: toggleTheme,
    },
    {
      id: 'act-language',
      label: language === 'en' ? 'Switch to Urdu (اردو)' : 'Switch to English',
      detail: 'Change language preference',
      icon: Globe,
      shortcut: 'L',
      section: 'preferences',
      onSelect: () => setLanguage(language === 'en' ? 'ur' : 'en'),
    },
  ];

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      (item.detail && item.detail.toLowerCase().includes(query.toLowerCase())),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        selected.onSelect();
        setOpen(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0 gap-0 shadow-2xl border-border bg-popover rounded-xl">
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        <div className="flex items-center border-b border-border px-3.5 py-3 gap-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="text"
            placeholder="Type a command or jump to a workspace..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No commands found for &ldquo;{query}&rdquo;</p>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-xs transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-muted/60',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.detail ? <p className="truncate text-[11px] text-muted-foreground">{item.detail}</p> : null}
                  </div>
                  {item.shortcut ? (
                    <kbd className="ms-auto shrink-0 font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                      {item.shortcut}
                    </kbd>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
          <span>Navigation: <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd></span>
          <span>Select: <kbd className="font-mono">↵</kbd></span>
          <span>Close: <kbd className="font-mono">esc</kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
