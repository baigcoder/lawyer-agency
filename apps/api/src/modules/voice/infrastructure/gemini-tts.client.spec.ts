import { describe, expect, it } from 'vitest';
import { findInlineAudio } from './gemini-tts.client';

describe('findInlineAudio', () => {
  it('finds the audio part in a generateContent response', () => {
    const body = {
      candidates: [{ content: { parts: [{ text: 'x' }, { inlineData: { mimeType: 'audio/L16;rate=24000', data: 'AAAA' } }] } }],
    };
    expect(findInlineAudio(body)).toEqual({ mimeType: 'audio/L16;rate=24000', data: 'AAAA' });
  });

  it('returns null for a text-only or malformed response', () => {
    expect(findInlineAudio({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] })).toBeNull();
    expect(findInlineAudio({ error: { code: 429 } })).toBeNull();
    expect(findInlineAudio(null)).toBeNull();
  });
});
