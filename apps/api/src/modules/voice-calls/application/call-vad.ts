export const SPEECH_RMS = 0.016;
const SILENCE_FLUSH_MS = 700;
const MIN_SPEECH_MS = 350;
const MAX_SPEECH_MS = 8_000;

export type VadAction = 'ignore' | 'hold' | 'flush';

export function vadAction(rms: number, bufferedMs: number, silenceMs: number): VadAction {
  if (bufferedMs >= MAX_SPEECH_MS) return 'flush';
  if (rms >= SPEECH_RMS) return 'hold';
  if (bufferedMs >= MIN_SPEECH_MS && silenceMs >= SILENCE_FLUSH_MS) return 'flush';
  if (bufferedMs > 0) return 'hold';
  return 'ignore';
}

export function pcmDurationMs(samples: Int16Array, sampleRate = 48_000): number {
  return (samples.length / sampleRate) * 1000;
}
