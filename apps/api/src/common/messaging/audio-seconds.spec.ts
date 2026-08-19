import { describe, expect, it } from 'vitest';
import { estimateMp3DurationSeconds, readAudioSeconds } from './audio-seconds';

describe('readAudioSeconds', () => {
  it('reads WhatsApp audioMessage.seconds', () => {
    expect(
      readAudioSeconds({
        message: { audioMessage: { seconds: 13, ptt: true } },
      }),
    ).toBe(13);
  });

  it('reads persisted durationSeconds', () => {
    expect(readAudioSeconds({ durationSeconds: 7 })).toBe(7);
  });

  it('coerces string seconds', () => {
    expect(readAudioSeconds({ message: { audioMessage: { seconds: '5' } } })).toBe(5);
  });
});

describe('estimateMp3DurationSeconds', () => {
  it('estimates from byte length', () => {
    expect(estimateMp3DurationSeconds(Buffer.alloc(16_000))).toBe(1);
  });
});
