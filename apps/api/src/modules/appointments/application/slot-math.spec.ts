import { describe, expect, it } from 'vitest';
import {
  PK_HOLIDAY_DATES,
  addDaysYmd,
  computeOpenSlots,
  pktDateTime,
  weekdayFromYmdPkt,
  ymdInPkt,
} from './slot-math';

describe('slot-math', () => {
  it('treats 0 as Sunday in PKT', () => {
    expect(weekdayFromYmdPkt('2026-08-16')).toBe(0);
    expect(weekdayFromYmdPkt('2026-08-19')).toBe(3);
  });

  it('adds calendar days without shifting the Y-M-D', () => {
    expect(addDaysYmd('2026-08-19', 1)).toBe('2026-08-20');
  });

  it('skips holidays and occupied slots', () => {
    const now = pktDateTime('2026-08-19', '08:00');
    expect(ymdInPkt(now)).toBe('2026-08-19');
    expect(PK_HOLIDAY_DATES.has('2026-08-14')).toBe(true);

    const slots = computeOpenSlots({
      availability: [
        { weekday: 3, startTime: '15:00', endTime: '16:00', slotDurationMinutes: 30 },
        { weekday: 4, startTime: '09:00', endTime: '10:00', slotDurationMinutes: 30 },
        { weekday: 5, startTime: '09:00', endTime: '10:00', slotDurationMinutes: 30 },
      ],
      busy: [
        { startsAt: pktDateTime('2026-08-21', '09:00'), endsAt: pktDateTime('2026-08-21', '09:30') },
      ],
      holidays: new Set(['2026-08-20']),
      now,
      horizonDays: 5,
      limit: 3,
    });

    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      pktDateTime('2026-08-19', '15:00').toISOString(),
      pktDateTime('2026-08-19', '15:30').toISOString(),
      pktDateTime('2026-08-21', '09:30').toISOString(),
    ]);
  });
});
