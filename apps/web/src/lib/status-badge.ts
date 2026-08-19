import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * Shared status→badge-variant helper (Batch 2b). Each domain had a hand-rolled
 * `Record<Status, BadgeVariant>` map; this builder removes the drift-prone
 * duplication and keeps the variant vocabulary in one place.
 *
 * Usage:
 *   const v = badgeVariants([
 *     ['PENDING','secondary'], ['SUCCEEDED','default'], ['FAILED','destructive'],
 *   ] as const);
 *   <Badge variant={v(row.status)}>…
 */
export function BadgeVariants<T extends string>(
  pairs: ReadonlyArray<readonly [T, BadgeVariant]>,
): Record<T, BadgeVariant> {
  return Object.fromEntries(pairs.map(([k, v]) => [k, v])) as Record<T, BadgeVariant>;
}

/** Centralizes the variant→tone mapping so semantic colors stay consistent. */
export const badgeTones = {
  success: 'default' as BadgeVariant,
  pending: 'secondary' as BadgeVariant,
  neutral: 'outline' as BadgeVariant,
  danger: 'destructive' as BadgeVariant,
};
