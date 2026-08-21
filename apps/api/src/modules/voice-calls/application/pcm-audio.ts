const WAV_HEADER = 44;

export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1): Buffer {
  const header = Buffer.alloc(WAV_HEADER);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export function wavToPcm(wav: Buffer): { pcm: Buffer; sampleRate: number; channels: number } {
  if (wav.length < WAV_HEADER || wav.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('not a WAV buffer');
  }
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bits = wav.readUInt16LE(34);
  if (bits !== 16) throw new Error(`unsupported WAV bit depth ${bits}`);
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === 'data') {
      return { pcm: wav.subarray(offset + 8, offset + 8 + size), sampleRate, channels };
    }
    offset += 8 + size;
  }
  throw new Error('WAV missing data chunk');
}

export function upsampleTo48k(pcm: Int16Array, fromRate: number): Int16Array {
  if (fromRate === 48000) return pcm;
  const ratio = 48000 / fromRate;
  const out = new Int16Array(Math.floor(pcm.length * ratio));
  for (let i = 0; i < out.length; i++) {
    out[i] = pcm[Math.min(pcm.length - 1, Math.floor(i / ratio))] ?? 0;
  }
  return out;
}

/** Nearest-neighbour downsample (48 kHz receptionist PCM → G.711 8 kHz). */
export function downsampleFrom48k(pcm: Int16Array, toRate: number): Int16Array {
  if (toRate === 48000) return pcm;
  const ratio = 48000 / toRate;
  const out = new Int16Array(Math.floor(pcm.length / ratio));
  for (let i = 0; i < out.length; i++) {
    out[i] = pcm[Math.min(pcm.length - 1, Math.round(i * ratio))] ?? 0;
  }
  return out;
}

export function int16ToPcmBuffer(pcm: Int16Array): Buffer {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
}

export function stereoFromMono(mono: Int16Array): Int16Array {
  const stereo = new Int16Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) {
    const sample = mono[i] ?? 0;
    stereo[i * 2] = sample;
    stereo[i * 2 + 1] = sample;
  }
  return stereo;
}

export function monoFromStereo(stereo: Int16Array): Int16Array {
  const mono = new Int16Array(Math.floor(stereo.length / 2));
  for (let i = 0; i < mono.length; i++) {
    const a = stereo[i * 2] ?? 0;
    const b = stereo[i * 2 + 1] ?? 0;
    mono[i] = Math.round((a + b) / 2);
  }
  return mono;
}

export function rmsInt16(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (const sample of pcm) sum += sample * sample;
  return Math.sqrt(sum / pcm.length) / 32768;
}

export function tonePcm48k(seconds: number, hz: number, gain = 0.18): Int16Array {
  const n = Math.floor(48000 * seconds);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / 48000) * gain * 32767);
  }
  return out;
}

export function pcmBufferToInt16(buf: Buffer): Int16Array {
  const aligned = buf.byteOffset % 2 === 0 ? buf : Buffer.from(buf);
  return new Int16Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.byteLength / 2));
}

export function concatInt16(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function padToFrame(mono: Int16Array, frame = 960): Int16Array {
  const rem = mono.length % frame;
  if (rem === 0) return mono;
  const out = new Int16Array(mono.length + (frame - rem));
  out.set(mono);
  return out;
}

export function rawPcmTo48kMono(pcm: Buffer, fromRate: number, channels: number): Int16Array {
  const samples = pcmBufferToInt16(pcm);
  const mono = channels === 2 ? monoFromStereo(samples) : samples;
  return upsampleTo48k(mono, fromRate);
}
