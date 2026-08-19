import Link from 'next/link';

/**
 * Shared footer for public/marketing routes (landing + legal pages). Links
 * the three policy pages required for Meta WhatsApp Business app review
 * (D-002) — previously these pages were orphaned with no inbound links.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>Wakeel — client intake for Pakistani law firms. AI assists; lawyers decide.</span>
        <nav aria-label="Legal" className="flex gap-3">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
          <Link href="/data-deletion" className="underline-offset-2 hover:underline">
            Data deletion
          </Link>
        </nav>
      </div>
    </footer>
  );
}
