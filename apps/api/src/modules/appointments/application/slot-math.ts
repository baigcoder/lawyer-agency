import holidays from './pk-holidays.json';

export const PKT_TIMEZONE = 'Asia/Karachi';

export interface WeeklyWindow {
  weekday: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface OpenSlot {
  startsAt: Date;
  endsAt: Date;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const PK_HOLIDAY_DATES = new Set(holidays.map((row) => row.date));

/** Calendar Y-M-D in Pakistan Standard Time. */
export function ymdInPkt(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function weekdayFromYmdPkt(ymd: string): number {
  const noonPkt = new Date(`${ymd}T12:00:00+05:00`);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: PKT_TIMEZONE, weekday: 'short' }).format(
    noonPkt,
  );
  return WEEKDAY_INDEX[label] ?? 0;
}

export function pktDateTime(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00+05:00`);
}

/**
 * Expand weekly lawyer windows into the next N PKT days, skip holidays and
 * occupied intervals, and return the earliest open slots.
 */
export function computeOpenSlots(params: {
  availability: readonly WeeklyWindow[];
  busy: readonly BusyInterval[];
  holidays?: ReadonlySet<string>;
  now: Date;
  horizonDays: number;
  limit: number;
  leadMinutes?: number;
}): OpenSlot[] {
  const holidays = params.holidays ?? PK_HOLIDAY_DATES;
  const leadMs = (params.leadMinutes ?? 15) * 60_000;
  const slots: OpenSlot[] = [];
  const startYmd = ymdInPkt(params.now);

  for (let offset = 0; offset < params.horizonDays && slots.length < params.limit; offset += 1) {
    const ymd = addDaysYmd(startYmd, offset);
    if (holidays.has(ymd)) continue;
    const weekday = weekdayFromYmdPkt(ymd);
    const windows = params.availability.filter((window) => window.weekday === weekday);
    for (const window of windows) {
      const durationMs = window.slotDurationMinutes * 60_000;
      if (durationMs <= 0) continue;
      let cursor = pktDateTime(ymd, window.startTime);
      const windowEnd = pktDateTime(ymd, window.endTime);
      while (cursor.getTime() + durationMs <= windowEnd.getTime() && slots.length < params.limit) {
        const end = new Date(cursor.getTime() + durationMs);
        const farEnough = cursor.getTime() > params.now.getTime() + leadMs;
        const overlaps = params.busy.some(
          (busy) => cursor.getTime() < busy.endsAt.getTime() && end.getTime() > busy.startsAt.getTime(),
        );
        if (farEnough && !overlaps) {
          slots.push({ startsAt: cursor, endsAt: end });
        }
        cursor = end;
      }
    }
  }

  return slots;
}
