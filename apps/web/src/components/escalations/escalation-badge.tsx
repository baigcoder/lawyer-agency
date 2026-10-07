'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { escalationListSchema } from '@/lib/schemas/escalations';
import { cn } from '@/lib/utils';

export function EscalationBadge({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['escalations', 'OPEN'],
    queryFn: () => apiRequest('/v1/escalations?status=OPEN', { schema: escalationListSchema }),
    refetchInterval: 10_000,
    retry: false,
  });

  const count = data?.length ?? 0;
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-pulse',
        className,
      )}
      aria-label={`${count} open escalations`}
    >
      {count}
    </span>
  );
}
