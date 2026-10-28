/**
 * Small WAV/PCM helpers shared by the HTTP TTS engines (Groq, Gemini).
 *
 * Engines differ in what they return: raw 16-bit PCM, or a whole WAV file —
 * and Gemini's WAVs carry a C2PA content-credentials chunk after the audio.
 * Treating a WAV as PCM makes its header click and the C2PA block play as
 * static, so audio always goes through `parseWav` before use.
 */

export interface PcmAudio {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}

/** The `data` chunk of a 16-bit PCM WAV, ignoring any chunk after it. */
export function parseWav(buffer: Buffer): PcmAudio | null {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let sampleRate = 0;
  let channels = 1;
  let bits = 16;
  for (let off = 12; off + 8 <= buffer.length; ) {
    const id = buffer.toString('ascii', off, off + 4);
    const len = buffer.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 24 <= buffer.length) {
      channels = buffer.readUInt16LE(off + 10);
      sampleRate = buffer.readUInt32LE(off + 12);
      bits = buffer.readUInt16LE(off + 22);
    }
    if (id === 'data') {
      if (!sampleRate || bits !== 16) return null;
      // Streamed WAVs may declare 0 or 0xFFFFFFFF: take what is actually there.
      const end = len === 0 || len === 0xffffffff ? buffer.length : Math.min(buffer.length, off + 8 + len);
      const pcm = buffer.subarray(off + 8, end - ((end - off - 8) % 2));
      return { pcm, sampleRate, channels };
    }
    off += 8 + len + (len % 2);
  }
  return null;
}

/** Mono 16-bit PCM wrapped as a WAV file. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function pcmDurationSeconds(audio: PcmAudio): number {
  return audio.pcm.length / 2 / audio.channels / audio.sampleRate;
}

export type SpeechCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether synthesized audio is plausibly the spoken text — the "bad voice"
 * gate between engines. Catches empty or silent audio, truncated clips, and
 * an engine reading its own instructions aloud (far too long for the text).
 * Bounds are deliberately loose: Urdu is spoken slower than English.
 */
export function checkSpeech(audio: PcmAudio, text: string): SpeechCheck {
  const seconds = pcmDurationSeconds(audio);
  const chars = text.trim().length;
  const minSeconds = Math.min(0.5, 0.02 * chars);
  const maxSeconds = 2 + chars * 0.2;
  if (seconds < minSeconds) return { ok: false, reason: `too short (${seconds.toFixed(2)}s for ${chars} chars)` };
  if (seconds > maxSeconds) return { ok: false, reason: `too long (${seconds.toFixed(2)}s for ${chars} chars)` };

  const samples = audio.pcm.length / 2;
  let sumSquares = 0;
  let clipped = 0;
  for (let i = 0; i < samples; i++) {
    const v = audio.pcm.readInt16LE(i * 2);
    sumSquares += v * v;
    if (v >= 32767 || v <= -32768) clipped++;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, samples));
  if (rms < 150) return { ok: false, reason: `near-silent (rms ${Math.round(rms)})` };
  if (clipped / Math.max(1, samples) > 0.01) return { ok: false, reason: 'heavily clipped (noise)' };
  return { ok: true };
}

/** Split text into chunks of at most `max` chars at sentence, then word, boundaries. */
export function chunkText(text: string, max: number): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?۔؟])\s+/);
  const chunks: string[] = [];
  let current = '';
  const push = (part: string) => {
    if (!current) current = part;
    else if (current.length + 1 + part.length <= max) current = `${current} ${part}`;
    else {
      chunks.push(current);
      current = part;
    }
  };
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      push(sentence);
      continue;
    }
    for (const word of sentence.split(' ')) {
      if (word.length > max) {
        for (let i = 0; i < word.length; i += max) push(word.slice(i, i + max));
      } else push(word);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
