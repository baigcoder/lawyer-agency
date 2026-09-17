import { describe, expect, it } from 'vitest';
import {
  buildElevenLabsTtsBody,
  classifyTtsFailure,
  isValidVoiceId,
  LIVE_TTS_MODEL,
  NOTE_TTS_MODEL,
  supportsLanguageCode,
  ttsBodyForModel,
  ttsModelPlan,
} from './elevenlabs-tts.request';
import { mergeVoices, retryAfterMs, retryDelayMs } from './elevenlabs-tts.client';
import { isSttFatal, sttModelOrder } from './elevenlabs-stt.client';

describe('supportsLanguageCode', () => {
  // Verified against the live API: only eleven_v3 accepts language_code 'ur';
  // the others answer 400 "does not support language_code 'ur'".
  it('knows only v3 takes an Urdu language code', () => {
    expect(supportsLanguageCode('eleven_v3', 'ur')).toBe(true);
    expect(supportsLanguageCode('eleven_turbo_v2_5', 'ur')).toBe(false);
    expect(supportsLanguageCode('eleven_flash_v2_5', 'ur')).toBe(false);
    expect(supportsLanguageCode('eleven_multilingual_v2', 'ur')).toBe(false);
  });

  it('knows every model takes an English language code', () => {
    for (const model of ['eleven_v3', 'eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_multilingual_v2']) {
      expect(supportsLanguageCode(model, 'en')).toBe(true);
    }
  });
});

describe('ttsBodyForModel', () => {
  const urduBody = buildElevenLabsTtsBody({ text: 'میں مدد کر سکتی ہوں۔', language: 'ur' });

  it('drops the Urdu language code for a model that would 400 on it', () => {
    const body = ttsBodyForModel(urduBody, 'eleven_turbo_v2_5', 'ur');
    expect(body).not.toHaveProperty('language_code');
    expect(body.model_id).toBe('eleven_turbo_v2_5');
  });

  it('keeps the Urdu language code for v3', () => {
    expect(ttsBodyForModel(urduBody, 'eleven_v3', 'ur').language_code).toBe('ur');
  });

  it('carries the tuned voice settings across every model', () => {
    for (const model of ['eleven_v3', 'eleven_turbo_v2_5', 'eleven_multilingual_v2']) {
      expect(ttsBodyForModel(urduBody, model, 'ur').voice_settings).toEqual(urduBody.voice_settings);
    }
  });
});

describe('ttsModelPlan', () => {
  it('leads an Urdu note with the only model that truly speaks Urdu', () => {
    // Leading with turbo meant a guaranteed 400 on every Urdu voice note.
    expect(ttsModelPlan({ language: 'ur', liveCall: false })[0]).toBe('eleven_v3');
  });

  it('leads a live call with the fastest model, whatever the language', () => {
    expect(ttsModelPlan({ language: 'ur', liveCall: true })[0]).toBe(LIVE_TTS_MODEL);
    expect(ttsModelPlan({ language: 'en', liveCall: true })[0]).toBe(LIVE_TTS_MODEL);
  });

  it('keeps v3 as the last resort on an Urdu call, ahead of robotic espeak', () => {
    expect(ttsModelPlan({ language: 'ur', liveCall: true })).toContain('eleven_v3');
    // An English call has faster options and does not need it.
    expect(ttsModelPlan({ language: 'en', liveCall: true })).not.toContain('eleven_v3');
  });

  it('does not offer the English-only model to an Urdu note', () => {
    // multilingual_v2 does not speak Urdu.
    expect(ttsModelPlan({ language: 'ur', liveCall: false })).not.toContain('eleven_multilingual_v2');
    expect(ttsModelPlan({ language: 'en', liveCall: false })).toContain('eleven_multilingual_v2');
  });

  it('starts an English note on the human-paced turbo model', () => {
    expect(ttsModelPlan({ language: 'en', liveCall: false })[0]).toBe(NOTE_TTS_MODEL);
  });
});

describe('classifyTtsFailure', () => {
  it('retries the same model on a rate limit — another model cannot clear it', () => {
    expect(classifyTtsFailure(429)).toBe('retry-same-model');
    expect(classifyTtsFailure(503)).toBe('retry-same-model');
  });

  it('moves to the next model when this one rejected the request', () => {
    expect(classifyTtsFailure(400)).toBe('next-model');
    expect(classifyTtsFailure(404)).toBe('next-model');
    expect(classifyTtsFailure(422)).toBe('next-model');
  });

  it('gives up immediately on a bad API key', () => {
    expect(classifyTtsFailure(401)).toBe('fatal');
    expect(classifyTtsFailure(403)).toBe('fatal');
  });
});

describe('isValidVoiceId', () => {
  it('accepts real ElevenLabs ids', () => {
    expect(isValidVoiceId('EXAVITQu4vr4xnSDxMaL')).toBe(true);
    expect(isValidVoiceId('FGY2WhTYpPnrIDTdsKH5')).toBe(true);
  });

  it('rejects anything that would rewrite the request path', () => {
    expect(isValidVoiceId('../../v1/user')).toBe(false);
    expect(isValidVoiceId('abc?output_format=mp3')).toBe(false);
    expect(isValidVoiceId('short')).toBe(false);
    expect(isValidVoiceId('')).toBe(false);
  });
});

describe('retryAfterMs', () => {
  it('honours the header ElevenLabs sends on a concurrency rejection', () => {
    expect(retryAfterMs({ headers: new Headers({ 'retry-after': '2' }) })).toBe(2_000);
  });

  it('caps the wait so a WhatsApp turn does not stall', () => {
    expect(retryAfterMs({ headers: new Headers({ 'retry-after': '600' }) })).toBe(5_000);
  });

  it('returns null when there is no usable header', () => {
    expect(retryAfterMs({ headers: new Headers() })).toBeNull();
    expect(retryAfterMs({ headers: new Headers({ 'retry-after': 'soon' }) })).toBeNull();
  });
});

describe('retryDelayMs', () => {
  it('backs off with jitter and stays bounded', () => {
    expect(retryDelayMs(0, () => 1)).toBe(400);
    expect(retryDelayMs(1, () => 1)).toBe(800);
    expect(retryDelayMs(9, () => 1)).toBe(2_000);
    expect(retryDelayMs(1, () => 0)).toBe(400);
  });
});

describe('sttModelOrder', () => {
  it('tries the newest model first on a cold start', () => {
    expect(sttModelOrder(null)).toEqual(['scribe_v2', 'scribe_v1']);
  });

  it('remembers the model that worked, so an account without v2 stops paying for it', () => {
    expect(sttModelOrder('scribe_v1')).toEqual(['scribe_v1', 'scribe_v2']);
  });
});

describe('isSttFatal', () => {
  it('does not try the other model when the key or quota is the problem', () => {
    expect(isSttFatal(new Error('ElevenLabs STT HTTP 401: bad key'))).toBe(true);
    expect(isSttFatal(new Error('ElevenLabs STT HTTP 429: too many'))).toBe(true);
  });

  it('does try the other model when this one rejected the request', () => {
    expect(isSttFatal(new Error('ElevenLabs STT HTTP 400: unknown model_id'))).toBe(false);
    expect(isSttFatal(new Error('fetch failed'))).toBe(false);
  });
});

describe('mergeVoices', () => {
  const curated = Array.from({ length: 10 }, (_, i) => ({
    id: `curated-${i}`,
    name: `Curated ${i}`,
    gender: 'female' as const,
    accent: 'American',
  }));
  const firmLibrary = Array.from({ length: 30 }, (_, i) => ({
    id: `firm-${i}`,
    name: `Firm ${i}`,
    gender: 'female' as const,
    accent: 'Hindi',
  }));

  it("keeps every one of the firm's own voices", () => {
    // The old cap of 30, with curated inserted first, silently cut the last of
    // the firm's voices — the one they had just added.
    const merged = mergeVoices(curated, firmLibrary);
    for (const voice of firmLibrary) {
      expect(merged.map((v) => v.id)).toContain(voice.id);
    }
  });

  it('lists the firm library ahead of the built-in fillers', () => {
    expect(mergeVoices(curated, firmLibrary)[0]?.id).toBe('firm-0');
  });

  it('does not duplicate a voice present in both lists', () => {
    const shared = { id: 'shared', name: 'Shared', gender: 'male' as const, accent: 'British' };
    const merged = mergeVoices([shared, ...curated], [shared, ...firmLibrary]);
    expect(merged.filter((v) => v.id === 'shared')).toHaveLength(1);
  });
});
