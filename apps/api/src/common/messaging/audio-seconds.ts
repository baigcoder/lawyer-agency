function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function coercePositiveSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return null;
}

/** WhatsApp PTT duration lives on audioMessage.seconds; we also persist durationSeconds. */
export function readAudioSeconds(payload: Record<string, unknown>): number | null {
  const direct = coercePositiveSeconds(payload['durationSeconds'] ?? payload['seconds']);
  if (direct) return direct;

  const message = asRecord(payload['message']);
  const nested = asRecord(message['message']);
  const audio = asRecord(
    message['audioMessage'] ?? message['pttMessage'] ?? nested['audioMessage'] ?? nested['pttMessage'],
  );
  return coercePositiveSeconds(audio['seconds']);
}

/** Rough CBR estimate used when TTS does not report duration. */
export function estimateMp3DurationSeconds(buffer: Buffer): number | null {
  if (buffer.length < 64) return null;
  return Math.max(1, Math.round((buffer.length * 8) / 128_000));
}
