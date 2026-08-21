import { describe, expect, it } from 'vitest';
import {
  LIVE_TTS_MODEL,
  NOTE_TTS_MODEL,
  URDU_CHAR_LIMIT,
  buildElevenLabsTtsBody,
  prepareSpokenTtsText,
  resolveTtsLanguage,
} from './elevenlabs-tts.request';

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

describe('prepareSpokenTtsText', () => {
  it('strips markdown and adds soft pauses between sentences', () => {
    expect(prepareSpokenTtsText('**Hello**\n\nHow can I help?')).toBe('Hello. ... How can I help?');
  });
});

describe('buildElevenLabsTtsBody', () => {
  it('uses turbo with language_code ur for WhatsApp Urdu notes', () => {
    const body = buildElevenLabsTtsBody({
      text: 'السلام علیکم، میں آپ کی کیسے مدد کر سکتا ہوں؟',
      language: 'ur',
    });
    expect(body.model_id).toBe(NOTE_TTS_MODEL);
    expect(body.language_code).toBe('ur');
    expect(body.apply_text_normalization).toBe('on');
    expect(body.voice_settings?.style).toBeGreaterThan(0);
    expect(body.voice_settings?.speed).toBeLessThan(0.9);
  });

  it('uses flash for live calls at a calm pace', () => {
    const body = buildElevenLabsTtsBody({
      text: 'How may I help you today?',
      language: 'en',
      liveCall: true,
    });
    expect(body.model_id).toBe(LIVE_TTS_MODEL);
    expect(body.voice_settings?.speed).toBeLessThan(1);
  });

  it('clips Urdu to the character limit', () => {
    const body = buildElevenLabsTtsBody({
      text: 'ہاں '.repeat(URDU_CHAR_LIMIT),
      language: 'ur',
    });
    expect(body.text.length).toBeLessThanOrEqual(URDU_CHAR_LIMIT);
  });
});
