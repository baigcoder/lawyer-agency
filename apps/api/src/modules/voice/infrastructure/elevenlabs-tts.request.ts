/**
 * ElevenLabs TTS: Turbo for WhatsApp notes (human pace), Flash for live calls.
 * `eleven_v3` is too slow for a WhatsApp turn; multilingual_v2 does not speak Urdu.
 */

import {
  SPOKEN_CHAR_LIMIT,
  clipSpokenText,
  prepareSpokenTtsText,
} from '../application/spoken-text';

export { SPOKEN_CHAR_LIMIT, prepareSpokenTtsText };
export const clipText = clipSpokenText;

export const NOTE_TTS_MODEL = 'eleven_turbo_v2_5';
export const LIVE_TTS_MODEL = 'eleven_flash_v2_5';
export const FALLBACK_QUALITY_TTS_MODEL = 'eleven_v3';
export const FALLBACK_ENGLISH_TTS_MODEL = 'eleven_multilingual_v2';
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
    style?: number;
    use_speaker_boost?: boolean;
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
  liveCall?: boolean;
}): ElevenLabsTtsBody {
  const language = resolveTtsLanguage(input.text, input.language);
  const spoken = prepareSpokenTtsText(input.text);
  const limit = language === 'ur' ? URDU_CHAR_LIMIT : ENGLISH_CHAR_LIMIT;
  return {
    text: clipSpokenText(spoken, limit),
    model_id: input.liveCall ? LIVE_TTS_MODEL : NOTE_TTS_MODEL,
    language_code: language,
    apply_text_normalization: 'on',
    voice_settings: input.liveCall
      ? {
          // Live calls stay slightly brisker, but still below a hurried read.
          stability: 0.5,
          similarity_boost: 0.78,
          speed: language === 'ur' ? 0.9 : 0.94,
        }
      : {
          // WhatsApp notes: calmer, human pace (clients complained TTS felt too fast).
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.22,
          use_speaker_boost: true,
          speed: language === 'ur' ? 0.84 : 0.88,
        },
  };
}
