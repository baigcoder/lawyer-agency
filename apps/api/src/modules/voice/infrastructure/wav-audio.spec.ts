import { describe, expect, it } from 'vitest';
import { checkSpeech, chunkText, parseWav, pcmToWav } from './wav-audio';

/** A 300 Hz tone, loud enough to count as speech. */
function tone(seconds: number, sampleRate = 24_000, amplitude = 8_000): Buffer {
  const n = Math.round(seconds * sampleRate);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 300 * i) / sampleRate) * amplitude), i * 2);
  return pcm;
}

describe('parseWav', () => {
  it('returns only the data chunk, ignoring a C2PA trailer after it', () => {
    const pcm = tone(0.2);
    const trailer = Buffer.concat([Buffer.from('C2PA'), Buffer.alloc(4), Buffer.alloc(6_000, 0x7f)]);
    const parsed = parseWav(Buffer.concat([pcmToWav(pcm, 24_000), trailer]));
    expect(parsed?.sampleRate).toBe(24_000);
    expect(parsed?.pcm.equals(pcm)).toBe(true);
  });

  it('rejects raw PCM that is not a WAV', () => {
    expect(parseWav(tone(0.1))).toBeNull();
  });
});

describe('checkSpeech', () => {
  const text = 'Your hearing is on Monday at nine.';

  it('accepts a plausible clip', () => {
    expect(checkSpeech({ pcm: tone(2), sampleRate: 24_000, channels: 1 }, text)).toEqual({ ok: true });
  });

  it('rejects silence', () => {
    const result = checkSpeech({ pcm: Buffer.alloc(24_000 * 2 * 2), sampleRate: 24_000, channels: 1 }, text);
    expect(result.ok).toBe(false);
  });

  it('rejects audio far too long for the text (an instruction read aloud)', () => {
    const result = checkSpeech({ pcm: tone(20), sampleRate: 24_000, channels: 1 }, text);
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects heavily clipped noise', () => {
    const noise = Buffer.alloc(24_000 * 2 * 2);
    for (let i = 0; i < noise.length / 2; i++) noise.writeInt16LE(i % 2 ? 32_767 : -32_768, i * 2);
    expect(checkSpeech({ pcm: noise, sampleRate: 24_000, channels: 1 }, text).ok).toBe(false);
  });
});

describe('chunkText', () => {
  it('keeps every chunk within the limit and loses no words', () => {
    const text = 'First sentence here. Second one is a little longer than the first. Third!';
    const chunks = chunkText(text, 40);
    expect(chunks.every((c) => c.length <= 40)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });

  it('splits on the Urdu full stop', () => {
    expect(chunkText('پہلا جملہ۔ دوسرا جملہ۔', 12)).toEqual(['پہلا جملہ۔', 'دوسرا جملہ۔']);
  });
});
