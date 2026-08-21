import { describe, expect, it } from 'vitest';
import { pcmToWav, rmsInt16, stereoFromMono, upsampleTo48k, downsampleFrom48k, wavToPcm, concatInt16, padToFrame, rawPcmTo48kMono } from './pcm-audio';

describe('pcm-audio', () => {
  it('round-trips a WAV header', () => {
    const pcm = Buffer.alloc(8);
    pcm.writeInt16LE(1000, 0);
    const wav = pcmToWav(pcm, 16000, 1);
    const parsed = wavToPcm(wav);
    expect(parsed.sampleRate).toBe(16000);
    expect(parsed.channels).toBe(1);
    expect(parsed.pcm.readInt16LE(0)).toBe(1000);
  });

  it('upsamples 16 kHz to 48 kHz', () => {
    const src = new Int16Array([1, 2, 3]);
    expect(upsampleTo48k(src, 16000).length).toBe(9);
  });

  it('downsamples 48 kHz to 8 kHz', () => {
    const src = new Int16Array(12).fill(7);
    expect(Array.from(downsampleFrom48k(src, 8000))).toEqual([7, 7]);
  });

  it('interleaves mono to stereo', () => {
    expect(Array.from(stereoFromMono(new Int16Array([5, 6])))).toEqual([5, 5, 6, 6]);
  });

  it('computes rms', () => {
    expect(rmsInt16(new Int16Array(100))).toBe(0);
    expect(rmsInt16(new Int16Array([32767, -32767]))).toBeGreaterThan(0.9);
  });

  it('pads to a 20ms frame', () => {
    expect(padToFrame(new Int16Array(10), 960).length).toBe(960);
    expect(padToFrame(new Int16Array(960), 960).length).toBe(960);
  });

  it('concatenates PCM chunks', () => {
    expect(Array.from(concatInt16([new Int16Array([1]), new Int16Array([2, 3])]))).toEqual([1, 2, 3]);
  });

  it('upsamples raw 24 kHz PCM to 48 kHz mono', () => {
    const src = Buffer.alloc(4);
    src.writeInt16LE(100, 0);
    src.writeInt16LE(200, 2);
    expect(rawPcmTo48kMono(src, 24000, 1).length).toBe(4);
  });
});
