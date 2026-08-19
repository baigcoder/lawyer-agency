import type { Language } from '../domain/types';

const PKT_TIMEZONE = 'Asia/Karachi';

export interface PendingAppointment {
  lawyerId: string;
  lawyerName: string;
  slots: Array<{ startsAt: string; endsAt: string }>;
}

export interface OfferedSlot {
  startsAt: Date;
  endsAt: Date;
}

export function parsePendingAppointment(fields: Record<string, unknown>): PendingAppointment | null {
  const raw = fields['pendingAppointment'];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record['lawyerId'] !== 'string' || typeof record['lawyerName'] !== 'string') return null;
  if (!Array.isArray(record['slots'])) return null;
  const slots = record['slots'].flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row['startsAt'] !== 'string' || typeof row['endsAt'] !== 'string') return [];
    return [{ startsAt: row['startsAt'], endsAt: row['endsAt'] }];
  });
  if (slots.length === 0) return null;
  return { lawyerId: record['lawyerId'], lawyerName: record['lawyerName'], slots };
}

export function serializePendingAppointment(
  lawyerId: string,
  lawyerName: string,
  slots: readonly OfferedSlot[],
): PendingAppointment {
  return {
    lawyerId,
    lawyerName,
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
  };
}

export function parseSlotChoice(
  clientText: string,
  pending: PendingAppointment | null,
): { startsAt: string; endsAt: string } | null {
  if (!pending || pending.slots.length === 0) return null;
  const trimmed = clientText.trim();
  const digit = /^(?:option\s*)?([1-3])(?:st|nd|rd|th)?[.!)]*$/i.exec(trimmed);
  if (digit) {
    const index = Number(digit[1]) - 1;
    return pending.slots[index] ?? null;
  }
  const ordinal = /^(first|second|third|pehla|doosra|teesra)[.!)]*$/i.exec(trimmed);
  if (ordinal) {
    const map: Record<string, number> = {
      first: 0,
      pehla: 0,
      second: 1,
      doosra: 1,
      third: 2,
      teesra: 2,
    };
    const index = map[ordinal[1]?.toLowerCase() ?? ''] ?? -1;
    return pending.slots[index] ?? null;
  }
  return null;
}

export function offeredSlotsFromPending(pending: PendingAppointment): OfferedSlot[] {
  return pending.slots.map((slot) => ({
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
  }));
}

export function formatSlotOffer(
  language: Language,
  lawyerName: string,
  slots: readonly OfferedSlot[],
): string {
  const lines = slots.map((slot, index) => `${index + 1}) ${formatSlotWhen(slot.startsAt, language)}`);
  if (language === 'UR') {
    return [
      `${lawyerName} کے ساتھ ملاقات کے لیے یہ اوقات دستیاب ہیں — 1، 2 یا 3 کا جواب دیں:`,
      ...lines,
    ].join('\n');
  }
  return [`I can book you with ${lawyerName}. Reply 1, 2, or 3:`, ...lines].join('\n');
}

export function formatNoSlots(language: Language): string {
  if (language === 'UR') {
    return 'اس ہفتے کوئی خالی وقت نہیں ہے۔ اگر آپ وکیل سے بات کرنا چاہیں تو لکھیں — میں پیغام بھیج دوں گی/گا۔';
  }
  return 'There are no open slots this week. Reply if you want to speak with a lawyer and I will pass your message on.';
}

export function formatReoffer(language: Language, lawyerName: string, slots: readonly OfferedSlot[]): string {
  const prefix =
    language === 'UR' ? 'وہ وقت اب دستیاب نہیں۔ نئے اختیارات:' : 'That time was just taken. Here are new options:';
  return `${prefix}\n${formatSlotOffer(language, lawyerName, slots)}`;
}

export function formatBookFailed(language: Language): string {
  if (language === 'UR') {
    return 'وہ وقت بک نہیں ہو سکا۔ وکیل جلد پیغام کرے گا۔';
  }
  return 'I could not book that time. A lawyer will follow up shortly.';
}

export function isBookingConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'P2002' || code === 'P2034' || code === '23P01') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /overlap|exclusion|already booked|conflicting key/i.test(message);
}

function formatSlotWhen(startsAt: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === 'UR' ? 'ur-PK' : 'en-PK', {
    timeZone: PKT_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(startsAt);
}
