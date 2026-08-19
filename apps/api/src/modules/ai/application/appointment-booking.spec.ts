import { describe, expect, it } from 'vitest';
import { isBookingConflict, parseSlotChoice } from './appointment-booking';

const pending = {
  lawyerId: 'lawyer-1',
  lawyerName: 'Adv. Ali',
  slots: [
    { startsAt: '2026-08-20T06:00:00.000Z', endsAt: '2026-08-20T06:30:00.000Z' },
    { startsAt: '2026-08-21T10:00:00.000Z', endsAt: '2026-08-21T10:30:00.000Z' },
    { startsAt: '2026-08-22T04:00:00.000Z', endsAt: '2026-08-22T04:30:00.000Z' },
  ],
};

describe('parseSlotChoice', () => {
  it('maps a digit reply onto the offered ISO range', () => {
    expect(parseSlotChoice('2', pending)?.startsAt).toBe('2026-08-21T10:00:00.000Z');
    expect(parseSlotChoice('option 1', pending)?.startsAt).toBe('2026-08-20T06:00:00.000Z');
    expect(parseSlotChoice('I need help', pending)).toBeNull();
  });
});

describe('isBookingConflict', () => {
  it('treats exclusion-constraint failures as conflicts', () => {
    expect(isBookingConflict({ code: '23P01' })).toBe(true);
    expect(isBookingConflict(new Error('new row violates exclusion constraint'))).toBe(true);
    expect(isBookingConflict(new Error('timeout'))).toBe(false);
  });
});
