import { describe, expect, it } from 'vitest';
import { isWithinCallHours } from './call-hours';

describe('isWithinCallHours', () => {
  it('is always open when start or end is blank', () => {
    expect(isWithinCallHours(new Date('2026-08-19T10:00:00Z'), '', '18:00', 'Asia/Karachi')).toBe(true);
    expect(isWithinCallHours(new Date('2026-08-19T10:00:00Z'), '09:00', '', 'Asia/Karachi')).toBe(true);
  });

  it('accepts a weekday morning in Karachi', () => {
    // 04:00 UTC = 09:00 PKT in August
    const morning = new Date('2026-08-19T04:30:00Z');
    expect(isWithinCallHours(morning, '09:00', '18:00', 'Asia/Karachi')).toBe(true);
    const night = new Date('2026-08-19T16:00:00Z');
    expect(isWithinCallHours(night, '09:00', '18:00', 'Asia/Karachi')).toBe(false);
  });
});
