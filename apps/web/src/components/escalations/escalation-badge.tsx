'use client';

import { useQuery } from '@tanstack/react-query';
import { NavCount } from '@/components/shell/app-sidebar';
import { apiRequest } from '@/lib/api-client';
import { escalationListSchema } from '@/lib/schemas/escalations';

/** Open escalations. Red, but static — a permanent pulse dilutes urgency. */
export function EscalationBadge() {
  const { data } = useQuery({
    queryKey: ['escalations', 'OPEN'],
    queryFn: () => apiRequest('/v1/escalations?status=OPEN', { schema: escalationListSchema }),
    refetchInterval: 10_000,
    retry: false,
  });
  const count = data?.length ?? 0;
  if (count <= 0) return null;
  return (
    <span aria-label={`${count} open escalations`}>
      <NavCount count={count} tone="critical" />
    </span>
  );
}
