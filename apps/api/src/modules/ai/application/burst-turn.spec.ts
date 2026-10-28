import { describe, expect, it } from 'vitest';
import { planBurstTurn, type BurstMessage } from './burst-turn';

const T0 = Date.parse('2026-10-28T10:00:00Z');
const msg = (id: string, offsetMs: number, body: string | null, processing = false): BurstMessage => ({
  id,
  createdAt: new Date(T0 + offsetMs),
  body,
  processing,
});

describe('planBurstTurn', () => {
  const burst = [
    msg('a', 0, 'Assalam o alaikum'),
    msg('b', 1_000, 'Police ne mere bhai ko arrest kar liya'),
    msg('c', 2_000, 'please help'),
  ];

  it('skips an older message so the newest answers the burst', () => {
    expect(planBurstTurn({ pending: burst, triggerId: 'a', now: T0 + 10_000 })).toMatchObject({ action: 'skip' });
  });

  it('waits while the client may still be typing', () => {
    const plan = planBurstTurn({ pending: burst, triggerId: 'c', now: T0 + 3_000 });
    expect(plan).toMatchObject({ action: 'wait' });
    if (plan.action === 'wait') expect(plan.delayMs).toBeLessThanOrEqual(4_000);
  });

  it('answers every pending message together, oldest first', () => {
    expect(planBurstTurn({ pending: burst, triggerId: 'c', now: T0 + 7_000 })).toEqual({
      action: 'answer',
      messageIds: ['a', 'b', 'c'],
      clientText: 'Assalam o alaikum\nPolice ne mere bhai ko arrest kar liya\nplease help',
    });
  });

  it('waits for an earlier voice note that is still being transcribed', () => {
    const pending = [msg('v', 0, null, true), msg('t', 1_000, '?')];
    expect(planBurstTurn({ pending, triggerId: 't', now: T0 + 8_000 })).toMatchObject({ action: 'wait' });
  });

  it('stops waiting at the cap, even if a transcription is stuck', () => {
    const pending = [msg('v', 0, null, true), msg('t', 1_000, 'hello?')];
    expect(planBurstTurn({ pending, triggerId: 't', now: T0 + 60_000 })).toMatchObject({
      action: 'answer',
      messageIds: ['v', 't'],
      clientText: 'hello?',
    });
  });

  it('answers a lone message after the quiet period', () => {
    expect(planBurstTurn({ pending: [msg('x', 0, 'Fee kitni hai?')], triggerId: 'x', now: T0 + 5_000 })).toEqual({
      action: 'answer',
      messageIds: ['x'],
      clientText: 'Fee kitni hai?',
    });
  });

  it('answers immediately and alone when batching is disabled', () => {
    expect(
      planBurstTurn({
        pending: burst,
        triggerId: 'a',
        now: T0 + 100,
        options: { settleMs: 0, maxWaitMs: 45_000, maxMessages: 12 },
      }),
    ).toEqual({ action: 'answer', messageIds: ['a'], clientText: 'Assalam o alaikum' });
  });

  it('answers a trigger that is no longer pending on its own', () => {
    expect(planBurstTurn({ pending: [], triggerId: 'gone', now: T0 })).toEqual({
      action: 'answer',
      messageIds: ['gone'],
      clientText: '',
    });
  });
});
