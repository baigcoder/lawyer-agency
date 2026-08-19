/**
 * ElevenLabs model/language selection for TTS.
 *
 * `eleven_multilingual_v2` does not include Urdu. The model that actually
 * speaks Urdu (ISO 639-3 `urd`) is `eleven_v3`, with `language_code: 'ur'`.
 */

export const ENGLISH_TTS_MODEL = 'eleven_multilingual_v2';
export const URDU_TTS_MODEL = 'eleven_v3';
export const URDU_CHAR_LIMIT = 5_000;
export const ENGLISH_CHAR_LIMIT = 10_000;

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

export type TtsLanguage = 'en' | 'ur';

export interface ElevenLabsTtsBody {
  text: string;
  model_id: string;
  language_code?: string;
  apply_text_normalization?: 'on' | 'off' | 'auto';
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    speed: number;
  };
}

export function resolveTtsLanguage(text: string, language?: TtsLanguage): TtsLanguage {
  if (language === 'ur') return 'ur';
  if (ARABIC_SCRIPT.test(text)) return 'ur';
  return 'en';
}

export function buildElevenLabsTtsBody(input: {
  text: string;
  language?: TtsLanguage;
}): ElevenLabsTtsBody {
  const language = resolveTtsLanguage(input.text, input.language);
  if (language === 'ur') {
    return {
      text: clipText(input.text, URDU_CHAR_LIMIT),
      model_id: URDU_TTS_MODEL,
      language_code: 'ur',
      apply_text_normalization: 'on',
      voice_settings: {
        stability: 0.62,
        similarity_boost: 0.8,
        speed: 0.94,
      },
    };
  }
  return {
    text: clipText(input.text, ENGLISH_CHAR_LIMIT),
    model_id: ENGLISH_TTS_MODEL,
  };
}

export function clipText(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const sliced = trimmed.slice(0, limit);
  const breakAt = Math.max(sliced.lastIndexOf('۔'), sliced.lastIndexOf('.'), sliced.lastIndexOf(' '));
  return (breakAt > limit * 0.6 ? sliced.slice(0, breakAt) : sliced).trim();
}
