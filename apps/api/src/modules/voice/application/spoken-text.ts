import { normalizeUrduForSpeech } from './urdu-speech';

/** Soft cap so WhatsApp / live-call TTS stays one short turn. */
export const SPOKEN_CHAR_LIMIT = 900;

/**
 * Make reply text sound like normal speech. TTS reads `/`, `—`, `*`, and
 * markdown aloud ("slash", "dash", "asterisk") — strip those before synthesize.
 */
export function prepareSpokenTtsText(
  text: string,
  voiceGender: 'male' | 'female' = 'male',
): string {
  // Urdu text goes through number/term/punctuation expansion first, so the
  // voice is never handed Latin script or bare digits mid-sentence.
  const cleaned = normalizeUrduForSpeech(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#~>]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    // Urdu gender doublets (سکتا/سکتی, گا/گی) — keep the form that matches the
    // voice. Always keeping the first one made a female voice say "کر سکتا
    // ہوں", which no Urdu speaker says about herself.
    // Not a gender pair → keep both halves and let the slash rule below turn
    // them into a pause. Dropping the second word silently mangled things like
    // "بارہ/تین" (a date) and "and/or".
    .replace(/([\p{L}\p{M}]+)\/([\p{L}\p{M}]+)/gu, (match, first: string, second: string) =>
      pickGenderedForm(first, second, voiceGender) ?? match,
    )
    // Em/en dashes and markdown rules → spoken pause (comma), never "dash".
    .replace(/\s*[—–―]+\s*/g, ', ')
    .replace(/\s*-{2,}\s*/g, ', ')
    // Leftover slashes (not dates like 12/3) → slight pause.
    .replace(/(?<!\d)\s*\/\s*(?!\d)/g, ', ')
    .replace(/[ \t]*\n+[ \t]*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.!?،۔])/g, '$1')
    .replace(/([.!?۔]){2,}/g, '$1')
    .replace(/,\s*,+/g, ',')
    // One opening beat so the reply does not start rushed. An ellipsis reads as
    // *hesitation* to the TTS engine, so one per sentence made a four-sentence
    // answer sound unsure of itself the whole way through; sentence-final
    // punctuation plus the tuned `speed` already carry the rest of the pacing.
    .replace(/([.!?۔])\s+/, '$1 ... ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
  return clipSpokenText(cleaned, SPOKEN_CHAR_LIMIT);
}

/**
 * Chooses between the two halves of an Urdu gender doublet by suffix rather
 * than by order, so it works whether the model wrote "سکتا/سکتی" or
 * "سکتی/سکتا". Feminine verb forms end in ی, masculine in ا.
 * Returns undefined when neither side looks gendered — then the caller keeps
 * the first, which is the old behaviour (e.g. an English "and/or").
 */
export function pickGenderedForm(
  first: string,
  second: string,
  voiceGender: 'male' | 'female',
): string | undefined {
  const feminine = (word: string) => /[یي]$/.test(word);
  const masculine = (word: string) => /[اآ]$/.test(word);
  if (voiceGender === 'female') {
    if (feminine(second) && masculine(first)) return second;
    if (feminine(first) && masculine(second)) return first;
    return undefined;
  }
  if (masculine(second) && feminine(first)) return second;
  if (masculine(first) && feminine(second)) return first;
  return undefined;
}

export function clipSpokenText(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const sliced = trimmed.slice(0, limit);
  const breakAt = Math.max(sliced.lastIndexOf('۔'), sliced.lastIndexOf('.'), sliced.lastIndexOf(' '));
  return (breakAt > limit * 0.6 ? sliced.slice(0, breakAt) : sliced).trim();
}
