import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { SynthesizeInput, SynthesizeResult } from '../application/text-to-speech.port';
import { CompositeTtsClient, parseProviderOrder, resamplePcm } from './composite-tts.client';
import type { ElevenLabsTtsClient } from './elevenlabs-tts.client';
import type { GeminiTtsClient } from './gemini-tts.client';
import type { GroqTtsClient } from './groq-tts.client';
import type { PcmAudio } from './wav-audio';

/** A 300 Hz tone, loud enough to count as speech. */
function tone(seconds: number, sampleRate = 24_000): Buffer {
  const n = Math.round(seconds * sampleRate);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 300 * i) / sampleRate) * 8_000), i * 2);
  return pcm;
}

type Outcome = 'ok' | 'fail' | 'too-long';

function audio(outcome: Outcome, sampleRate = 24_000): PcmAudio {
  if (outcome === 'fail') throw new Error('provider down');
  return { pcm: tone(outcome === 'too-long' ? 30 : 2, sampleRate), sampleRate, channels: 1 };
}

function build(opts: { groq?: Outcome; eleven?: Outcome; gemini?: Outcome; geminiRate?: number; order?: string }) {
  const calls: string[] = [];
  const groq = {
    isConfigured: () => opts.groq !== undefined,
    speaks: (lang: 'ur' | 'en') => lang === 'en',
    modelName: 'canopylabs/orpheus-v1-english',
    synthesize: async () => {
      calls.push('groq');
      return audio(opts.groq ?? 'fail');
    },
  } as unknown as GroqTtsClient;
  const elevenLabs = {
    isConfigured: () => opts.eleven !== undefined,
    synthesizeRemote: async (input: SynthesizeInput): Promise<SynthesizeResult> => {
      calls.push('elevenlabs');
      if (opts.eleven === 'fail') throw new Error('quota exceeded');
      const live = input.outputFormat === 'pcm_24000';
      return {
        audioBuffer: live ? tone(2) : Buffer.alloc(4_000, 1),
        mimeType: live ? 'audio/pcm' : 'audio/mpeg',
        charactersUsed: input.text.length,
        model: 'eleven_turbo_v2_5',
      };
    },
  } as unknown as ElevenLabsTtsClient;
  const gemini = {
    isConfigured: () => opts.gemini !== undefined,
    speaks: () => true,
    synthesize: async () => {
      calls.push('gemini');
      return { audio: audio(opts.gemini ?? 'fail', opts.geminiRate), model: 'gemini-3.1-flash-tts-preview' };
    },
  } as unknown as GeminiTtsClient;
  const config = { get: () => opts.order ?? 'groq,elevenlabs,gemini' } as unknown as ConfigService<never, true>;
  return { client: new CompositeTtsClient(config, elevenLabs, groq, gemini), calls };
}

const english = { text: 'Your hearing is on Monday at nine.', voiceGender: 'female', language: 'en' } as const;
const urdu = { text: 'آپ کی پیشی پیر کو نو بجے ہے۔', voiceGender: 'male', language: 'ur' } as const;

describe('CompositeTtsClient', () => {
  it('uses Groq first for English', async () => {
    const { client, calls } = build({ groq: 'ok', eleven: 'ok', gemini: 'ok' });
    const result = await client.synthesize(english);
    expect(result.model).toBe('groq/canopylabs/orpheus-v1-english');
    expect(result.mimeType).toBe('audio/wav');
    expect(calls).toEqual(['groq']);
  });

  it('falls back to ElevenLabs when Groq fails', async () => {
    const { client, calls } = build({ groq: 'fail', eleven: 'ok', gemini: 'ok' });
    const result = await client.synthesize(english);
    expect(result.model).toBe('eleven_turbo_v2_5');
    expect(calls).toEqual(['groq', 'elevenlabs']);
  });

  it('skips Groq for Urdu and reaches Gemini when ElevenLabs is out of quota', async () => {
    const { client, calls } = build({ groq: 'ok', eleven: 'fail', gemini: 'ok' });
    const result = await client.synthesize(urdu);
    expect(calls).toEqual(['elevenlabs', 'gemini']);
    expect(result.model).toBe('gemini-3.1-flash-tts-preview');
  });

  it('treats bad audio as a failure and moves on', async () => {
    const { client, calls } = build({ groq: 'too-long', eleven: 'ok' });
    const result = await client.synthesize(english);
    expect(calls).toEqual(['groq', 'elevenlabs']);
    expect(result.model).toBe('eleven_turbo_v2_5');
  });

  it('returns raw 24 kHz PCM for live calls, resampling when needed', async () => {
    const { client } = build({ gemini: 'ok', geminiRate: 48_000 });
    const result = await client.synthesize({ ...urdu, outputFormat: 'pcm_24000' });
    expect(result.mimeType).toBe('audio/pcm');
    expect(result.audioBuffer.length).toBe(tone(2).length);
  });

  it('throws on a live call when every engine fails (no espeak for calls)', async () => {
    const { client } = build({ groq: 'fail', eleven: 'fail', gemini: 'fail' });
    await expect(client.synthesize({ ...english, outputFormat: 'pcm_24000' })).rejects.toThrow(/groq.*elevenlabs.*gemini/);
  });

  it('honours a custom engine order', async () => {
    const { client, calls } = build({ groq: 'ok', eleven: 'ok', gemini: 'ok', order: 'gemini,groq' });
    await client.synthesize(english);
    expect(calls).toEqual(['gemini']);
  });
});

describe('parseProviderOrder', () => {
  it('ignores unknown and duplicate names', () => {
    expect(parseProviderOrder(' Gemini, foo, groq, gemini ')).toEqual(['gemini', 'groq']);
  });

  it('falls back to the default order when nothing is usable', () => {
    expect(parseProviderOrder('nope')).toEqual(['groq', 'elevenlabs', 'gemini']);
  });
});

describe('resamplePcm', () => {
  it('halves the sample count from 48 kHz to 24 kHz', () => {
    expect(resamplePcm(tone(1, 48_000), 48_000, 24_000).length).toBe(tone(1, 24_000).length);
  });
});
