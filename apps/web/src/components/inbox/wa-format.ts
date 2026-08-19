import type { InboxMessage } from '@/lib/schemas/inbox';

const AVATAR_COLORS = [
  '#00a884',
  '#53bdeb',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
] as const;

export function waAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export function waInitials(name: string | null, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
  }
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-2) || '?';
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatWaClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatWaListTime(date: Date, yesterdayLabel: string): string {
  const now = new Date();
  if (dayKey(date) === dayKey(now)) return formatWaClock(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return yesterdayLabel;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatWaDayLabel(date: Date, todayLabel: string, yesterdayLabel: string): string {
  const now = new Date();
  if (dayKey(date) === dayKey(now)) return todayLabel;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return yesterdayLabel;
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

export function shouldShowDayChip(messages: InboxMessage[], index: number): boolean {
  const current = messages[index];
  if (!current) return false;
  const previous = messages[index - 1];
  if (!previous) return true;
  return dayKey(current.createdAt) !== dayKey(previous.createdAt);
}

export function isBubbleRunStart(messages: InboxMessage[], index: number): boolean {
  const current = messages[index];
  const previous = messages[index - 1];
  if (!current) return false;
  if (!previous) return true;
  if (dayKey(current.createdAt) !== dayKey(previous.createdAt)) return true;
  return current.direction !== previous.direction || current.senderType !== previous.senderType;
}
