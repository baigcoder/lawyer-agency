import { describe, expect, it } from 'vitest';
import { resolveSendMode, rollSessionWindow } from './window-policy';

describe('24h session window policy (D-003)', () => {
  const now = new Date('2026-08-12T12:00:00Z');

  it('requires a template when no window was ever opened', () => {
    expect(resolveSendMode(null, now)).toBe('TEMPLATE_REQUIRED');
  });

  it('allows free-form strictly inside the window', () => {
    const expires = new Date(now.getTime() + 60_000);
    expect(resolveSendMode(expires, now)).toBe('FREEFORM');
  });

  it('requires a template the instant the window closes', () => {
    const expires = new Date(now.getTime());
    expect(resolveSendMode(expires, now)).toBe('TEMPLATE_REQUIRED');
  });

  it('rolls exactly 24h from the client message timestamp', () => {
    const sent = new Date('2026-08-11T09:30:00Z');
    expect(rollSessionWindow(sent).toISOString()).toBe('2026-08-12T09:30:00.000Z');
  });
});
