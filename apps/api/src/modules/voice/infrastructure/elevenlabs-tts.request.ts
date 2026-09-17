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

/**
 * Models that accept `language_code: 'ur'`. Verified against the live API:
 * turbo_v2_5, flash_v2_5 and multilingual_v2 all reject it with
 * "Model '…' does not support language_code 'ur'". They still speak Urdu text
 * correctly — they infer the language from the Arabic script — so the fix is to
 * omit the field for them, not to avoid the model.
 */
const URDU_LANGUAGE_CODE_MODELS = new Set([FALLBACK_QUALITY_TTS_MODEL]);

export function supportsLanguageCode(model: string, language: TtsLanguage): boolean {
  return language === 'en' || URDU_LANGUAGE_CODE_MODELS.has(model);
}

/**
 * Re-targets a prepared body at one model, keeping every tuned setting and
 * dropping only `language_code` when that model would reject it. Sending an
 * unsupported code is a hard 400, so an Urdu note used to fail its first
 * attempt every single time before falling through to v3.
 */
export function ttsBodyForModel(
  base: ElevenLabsTtsBody,
  model: string,
  language: TtsLanguage,
): ElevenLabsTtsBody {
  const next: ElevenLabsTtsBody = { ...base, model_id: model };
  if (supportsLanguageCode(model, language)) next.language_code = language;
  else delete next.language_code;
  return next;
}

/**
 * Ordered models to try for one synthesis.
 *
 * Urdu notes lead with `eleven_v3`: it is the only model with real Urdu
 * language support, and it is already what an Urdu note ends up using today
 * (turbo 400s first), so leading with it keeps the audio the firm ships while
 * removing the wasted request. Turbo follows as the fast recovery.
 *
 * A live call leads with Flash and keeps v3 last: a caller cannot sit through
 * the slowest model, but reaching it beats dropping to robotic espeak.
 * `multilingual_v2` stays English-only — it does not speak Urdu well.
 */
export function ttsModelPlan(input: {
  language: TtsLanguage;
  liveCall: boolean;
  /** Firm-chosen model for Urdu notes; the other is kept as the fallback. */
  urduNoteModel?: string;
}): string[] {
  if (input.liveCall) {
    return input.language === 'ur'
      ? [LIVE_TTS_MODEL, NOTE_TTS_MODEL, FALLBACK_QUALITY_TTS_MODEL]
      : [LIVE_TTS_MODEL, NOTE_TTS_MODEL];
  }
  if (input.language === 'ur') {
    const preferred = input.urduNoteModel ?? FALLBACK_QUALITY_TTS_MODEL;
    const other = preferred === FALLBACK_QUALITY_TTS_MODEL ? NOTE_TTS_MODEL : FALLBACK_QUALITY_TTS_MODEL;
    return [preferred, other];
  }
  return [NOTE_TTS_MODEL, FALLBACK_QUALITY_TTS_MODEL, FALLBACK_ENGLISH_TTS_MODEL];
}

/**
 * ElevenLabs voice IDs are 20-character alphanumerics. The tenant-supplied
 * `aiVoiceId` is only length-capped, and it used to be interpolated straight
 * into the request path — a value with `/` or `?` rewrites the URL, and any
 * malformed value 404s through the entire fallback chain before espeak.
 */
export function isValidVoiceId(voiceId: string): boolean {
  return /^[A-Za-z0-9]{16,32}$/.test(voiceId);
}

/**
 * Failure kinds need different responses: a rate limit or a server blip should
 * be retried on the *same* model after a wait, while a model-level rejection
 * should move to the next model at once. Switching models on a 429 — what this
 * used to do — cannot clear a concurrency limit and spends two more requests.
 */
export type TtsFailure = 'retry-same-model' | 'next-model' | 'fatal';

export function classifyTtsFailure(status: number): TtsFailure {
  if (status === 401 || status === 403) return 'fatal'; // bad key: nothing helps
  if (status === 429 || status >= 500) return 'retry-same-model';
  return 'next-model';
}

export function buildElevenLabsTtsBody(input: {
  text: string;
  language?: TtsLanguage;
  liveCall?: boolean;
  /** Resolves Urdu gender doublets to match the voice doing the speaking. */
  voiceGender?: 'male' | 'female';
}): ElevenLabsTtsBody {
  const language = resolveTtsLanguage(input.text, input.language);
  const spoken = prepareSpokenTtsText(input.text, input.voiceGender ?? 'male');
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
