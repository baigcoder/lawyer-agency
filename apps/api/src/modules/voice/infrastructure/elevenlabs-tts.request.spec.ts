import { describe, expect, it } from 'vitest';
import { URDU_CHAR_LIMIT, URDU_TTS_MODEL, buildElevenLabsTtsBody, resolveTtsLanguage } from './elevenlabs-tts.request';

describe('resolveTtsLanguage', () => {
  it('uses the explicit Urdu flag', () => {
    expect(resolveTtsLanguage('hello', 'ur')).toBe('ur');
  });

  it('treats Arabic-script text as Urdu even when language is English', () => {
    expect(resolveTtsLanguage('السلام علیکم', 'en')).toBe('ur');
  });

  it('defaults Latin text to English', () => {
    expect(resolveTtsLanguage('How may I help you?', 'en')).toBe('en');
  });
});

describe('buildElevenLabsTtsBody', () => {
  it('uses eleven_v3 and language_code ur for Urdu', () => {
    const body = buildElevenLabsTtsBody({
      text: 'السلام علیکم، میں آپ کی کیسے مدد کر سکتا ہوں؟',
      language: 'ur',
    });
    expect(body.model_id).toBe(URDU_TTS_MODEL);
    expect(body.language_code).toBe('ur');
    expect(body.apply_text_normalization).toBe('on');
  });

  it('keeps multilingual v2 for English without a language_code', () => {
    const body = buildElevenLabsTtsBody({
      text: 'How may I help you today?',
      language: 'en',
    });
    expect(body.model_id).toBe('eleven_multilingual_v2');
    expect(body.language_code).toBeUndefined();
  });

  it('clips Urdu to the v3 character limit', () => {
    const body = buildElevenLabsTtsBody({
      text: 'ہاں '.repeat(URDU_CHAR_LIMIT),
      language: 'ur',
    });
    expect(body.text.length).toBeLessThanOrEqual(URDU_CHAR_LIMIT);
  });
});
