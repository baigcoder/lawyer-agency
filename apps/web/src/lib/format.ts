/**
 * Shared formatters — one place for money, enum, and date rendering so the
 * dashboard stops drifting between `PKR {toLocaleString}`, `{toFixed(2)} {currency}`,
 * bare `toLocaleDateString()`, and three different enum-humanizing styles
 * (one of which used a non-global `_` replace and broke on double-underscore
 * values like IN_COURT).
 */

/** "IN_COURT" → "in court"; "RECORDED_MANUAL" → "recorded manual". Undefined/empty → "". */
export function humanizeEnum(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').toLowerCase();
}

/** Integer minor units → "PKR 12,500". Defaults to PKR; pass currency for others. */
export function formatMoney(cents: number, currency = 'PKR'): string {
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

/** ISO/string/Date → "17 Aug 2026" (default) or a custom Intl format. */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Date(date).toLocaleDateString(undefined, options);
}

/** Relative "2m"/"38m"/"1h"/"3d" for inbox-style previews. */
export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Remaining time until an SLA deadline, or how long it is overdue. */
export function formatSlaRemaining(deadline: string | Date): { label: string; overdue: boolean } {
  const ms = new Date(deadline).getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let amount: string;
  if (days > 0) amount = `${days}d`;
  else if (hours > 0) amount = `${hours}h`;
  else amount = `${Math.max(1, minutes)}m`;
  return { label: amount, overdue };
}

/** Whole days since a timestamp (0 if today). */
export function daysSince(date: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

/** "SA" from "Sana Ahmed" — avatar initials for inbox/conversation rows. */
export function initialsOf(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2);
}
