'use client';

import Link from 'next/link';
import { WakeelMonogram } from '@/components/wakeel-monogram';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/**
 * Shared footer for public routes. Links the three policy pages required for
 * Meta WhatsApp Business app review (D-002).
 */
export function MarketingFooter() {
  const { t, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;

  const product = [
    { href: '/#formation', label: t('navFormation') },
    { href: '/#handoff', label: t('navHandoff') },
    { href: '/#control', label: t('navControl') },
    { href: '/demo', label: t('demo') },
  ];
  const legal = [
    { href: '/privacy', label: t('footerPrivacy') },
    { href: '/terms', label: t('footerTerms') },
    { href: '/data-deletion', label: t('footerDeletion') },
  ];

  return (
    <footer className="border-t border-border bg-sunken" dir={dir}>
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <WakeelMonogram className="h-7 w-7" />
            <span className="font-semibold tracking-[-0.02em]">Wakeel</span>
          </div>
          <p className={cn('mt-4 max-w-sm text-sm leading-6 text-muted-foreground', urdu)}>{t('footerTagline')}</p>
          <p className="docket mt-6 text-muted-foreground">{t('trustedNoAdvice')}</p>
        </div>
        {[
          { title: t('footerProduct'), links: product },
          { title: t('footerLegal'), links: legal },
        ].map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="docket text-muted-foreground">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={cn('text-sm text-foreground/80 underline-offset-4 hover:text-foreground hover:underline', urdu)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
