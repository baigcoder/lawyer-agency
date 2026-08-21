/** Soft cap so WhatsApp / live-call TTS stays one short turn. */
export const SPOKEN_CHAR_LIMIT = 900;

/**
 * Make reply text sound like normal speech. TTS reads `/`, `—`, `*`, and
 * markdown aloud ("slash", "dash", "asterisk") — strip those before synthesize.
 */
export function prepareSpokenTtsText(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#~>]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    // Urdu gender doublets (سکتا/سکتی, گی/گا) — keep the first form only.
    .replace(/([\p{L}\p{M}]+)\/([\p{L}\p{M}]+)/gu, '$1')
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
    // Soft pauses so replies sound less rushed than a single run-on sentence.
    .replace(/([.!?۔])\s+/g, '$1 ... ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
  return clipSpokenText(cleaned, SPOKEN_CHAR_LIMIT);
}

export function clipSpokenText(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const sliced = trimmed.slice(0, limit);
  const breakAt = Math.max(sliced.lastIndexOf('۔'), sliced.lastIndexOf('.'), sliced.lastIndexOf(' '));
  return (breakAt > limit * 0.6 ? sliced.slice(0, breakAt) : sliced).trim();
}
