import { describe, expect, it } from 'vitest';
import rtp from '@vexyl.ai/sip/rtp';
import {
  downsampleFrom48k,
  int16ToPcmBuffer,
  pcmBufferToInt16,
  upsampleTo48k,
} from './pcm-audio';

describe('G.711 PCMU resample', () => {
  it('downsamples a 20ms 48 kHz frame to 160 samples at 8 kHz', () => {
    const src = new Int16Array(960).fill(1234);
    const down = downsampleFrom48k(src, 8000);
    expect(down.length).toBe(160);
    expect(down[0]).toBe(1234);
  });

  it('round-trips 8 kHz PCM through PCMU and upsamples to 48 kHz', () => {
    const src8k = new Int16Array(160);
    for (let i = 0; i < src8k.length; i++) {
      src8k[i] = Math.round(Math.sin(i / 8) * 8000);
    }
    const ulaw = rtp.pcmuEncode(int16ToPcmBuffer(src8k));
    expect(ulaw.length).toBe(160);
    const decoded = pcmBufferToInt16(rtp.pcmuDecode(ulaw));
    expect(decoded.length).toBe(160);
    const sample = src8k[10] ?? 0;
    const recovered = decoded[10] ?? 0;
    expect(Math.abs(recovered - sample)).toBeLessThan(1500);
    expect(upsampleTo48k(decoded, 8000).length).toBe(960);
  });
});
