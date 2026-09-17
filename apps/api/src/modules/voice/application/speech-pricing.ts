/**
 * What speech costs, so it can be metered against a tenant's budget.
 *
 * LLM calls were logged to `ai_logs` with a real cost from the start; TTS and
 * STT were not metered at all, even though ElevenLabs bills per character and
 * is plausibly the largest variable cost per tenant. A single long Urdu voice
 * note is thousands of characters.
 *
 * These are list prices and will drift. They exist to make spend visible and
 * boundable, not to reconcile an invoice to the cent.
 */

/** USD per 1,000 characters synthesized. */
const TTS_USD_PER_1K_CHARS: Record<string, number> = {
  // ElevenLabs Creator-tier effective rate; Flash/Turbo bill at half.
  eleven_v3: 0.15,
  eleven_multilingual_v2: 0.15,
  eleven_turbo_v2_5: 0.075,
  eleven_flash_v2_5: 0.075,
};

/** USD per minute of audio transcribed. */
const STT_USD_PER_MINUTE: Record<string, number> = {
  scribe_v1: 0.006,
  scribe_v2: 0.006,
  'whisper-large-v3': 0.000185, // Groq
  'whisper-large-v3-turbo': 0.000067,
  'whisper-1': 0.006, // OpenAI
};

/** Local engines cost nothing; unknown cloud models are priced conservatively. */
const FREE_ENGINES = new Set(['espeak-ng', 'espeak']);

export function ttsCostMicros(model: string, characters: number): number {
  if (FREE_ENGINES.has(model)) return 0;
  const rate = TTS_USD_PER_1K_CHARS[model] ?? 0.15;
  return Math.round((Math.max(0, characters) / 1_000) * rate * 1_000_000);
}

export function sttCostMicros(model: string, seconds: number): number {
  if (FREE_ENGINES.has(model)) return 0;
  const rate = STT_USD_PER_MINUTE[model] ?? 0.006;
  return Math.round((Math.max(0, seconds) / 60) * rate * 1_000_000);
}

/**
 * Seconds of audio in a PCM buffer, for metering a transcription whose source
 * duration is not otherwise known.
 */
export function pcmSeconds(sampleCount: number, sampleRate: number): number {
  if (sampleRate <= 0) return 0;
  return sampleCount / sampleRate;
}
