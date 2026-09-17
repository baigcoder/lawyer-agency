import { describe, expect, it } from 'vitest';
import { FRAME_MS, frameDelayMs } from './webrtc-bridge';

describe('frameDelayMs', () => {
  it('lets the first frames go out immediately to prime the jitter buffer', () => {
    expect(frameDelayMs(1, 0)).toBe(0);
    expect(frameDelayMs(5, 0)).toBe(0);
  });

  it('paces later frames to real time instead of bursting the whole turn', () => {
    // Frame 20 is due at 400ms of audio, minus the 120ms playout lead.
    expect(frameDelayMs(20, 0)).toBe(20 * FRAME_MS - 120);
  });

  it('never waits when sending has already fallen behind', () => {
    expect(frameDelayMs(20, 5_000)).toBe(0);
  });

  it('absorbs jitter: time already spent shortens the next wait', () => {
    const dueAt = 30 * FRAME_MS - 120; // 480ms
    expect(frameDelayMs(30, 400)).toBe(dueAt - 400);
    expect(frameDelayMs(30, 460)).toBe(dueAt - 460);
    expect(frameDelayMs(30, dueAt)).toBe(0);
  });
});
