import Link from 'next/link';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Root 404 boundary (Batch 2d) — branded instead of Next's default,
 * with a clear path back into the product.
 */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Scale className="h-5 w-5" aria-hidden />
        Wakeel
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Back to dashboard
      </Button>
    </main>
  );
}
