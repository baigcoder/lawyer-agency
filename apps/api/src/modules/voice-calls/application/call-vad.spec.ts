import { describe, expect, it } from 'vitest';
import { vadAction } from './call-vad';

describe('vadAction', () => {
  it('holds while the caller is speaking', () => {
    expect(vadAction(0.05, 200, 0)).toBe('hold');
  });

  it('flushes after enough speech plus silence', () => {
    expect(vadAction(0.001, 500, 800)).toBe('flush');
  });

  it('flushes a long uninterrupted utterance', () => {
    expect(vadAction(0.2, 9000, 0)).toBe('flush');
  });

  it('ignores background noise with an empty buffer', () => {
    expect(vadAction(0.001, 0, 800)).toBe('ignore');
  });
});
