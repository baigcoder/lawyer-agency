import { describe, expect, it } from 'vitest';
import { elevenLabsLanguageCode } from './elevenlabs-stt.client';

describe('elevenLabsLanguageCode', () => {
  it('maps Urdu and English hints to ISO-639-3', () => {
    expect(elevenLabsLanguageCode('ur')).toBe('urd');
    expect(elevenLabsLanguageCode('en')).toBe('eng');
    expect(elevenLabsLanguageCode(undefined)).toBeUndefined();
  });
});
