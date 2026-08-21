import { describe, expect, it, vi } from 'vitest';
import { CompositeSttClient, looksLikeWrongUrdu, pickPreferredSttTranscript } from './composite-stt.client';
import type { ElevenLabsSttClient } from './elevenlabs-stt.client';
import type { OpenAiWhisperClient } from './openai-whisper.client';

vi.mock('./prepare-stt-audio', () => ({
  prepareSttAudio: async (buffer: Buffer, mimeType: string) => ({ buffer, mimeType }),
}));

describe('CompositeSttClient', () => {
  const wav = {
    audioBuffer: Buffer.from('audio'),
    mimeType: 'audio/wav',
    languageHint: 'ur' as const,
  };

  it('returns the first usable transcript when providers race', async () => {
    const whisper = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { text: 'slow english', language: 'en' };
      }),
    } as unknown as OpenAiWhisperClient;
    const elevenLabs = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: 'مجھے مدد چاہیے', language: 'urd' })),
    } as unknown as ElevenLabsSttClient;

    const client = new CompositeSttClient(whisper, elevenLabs);
    const result = await client.transcribe(wav);
    expect(result.text).toContain('مدد');
    expect(elevenLabs.transcribe).toHaveBeenCalledOnce();
    expect(whisper.transcribe).toHaveBeenCalledOnce();
  });

  it('falls back to Whisper when Scribe returns empty', async () => {
    const whisper = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: 'hello', language: 'en' })),
    } as unknown as OpenAiWhisperClient;
    const elevenLabs = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: '', language: 'urd' })),
    } as unknown as ElevenLabsSttClient;

    const client = new CompositeSttClient(whisper, elevenLabs);
    await expect(client.transcribe(wav)).resolves.toEqual({ text: 'hello', language: 'en' });
  });

  it('waits for Scribe when Whisper guesses English for Urdu audio', async () => {
    const whisper = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: 'I need some help please', language: 'en' })),
    } as unknown as OpenAiWhisperClient;
    const elevenLabs = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: 'مجھے مدد چاہیے', language: 'urd' })),
    } as unknown as ElevenLabsSttClient;

    const client = new CompositeSttClient(whisper, elevenLabs);
    await expect(client.transcribe(wav)).resolves.toEqual({ text: 'مجھے مدد چاہیے', language: 'urd' });
  });

  it('prefers a late Arabic-script peer over an early ASCII transcript', async () => {
    const whisper = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => ({ text: 'I need some help please', language: 'en' })),
    } as unknown as OpenAiWhisperClient;
    const elevenLabs = {
      isConfigured: () => true,
      transcribe: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { text: 'مجھے مدد چاہیے', language: 'urd' };
      }),
    } as unknown as ElevenLabsSttClient;

    const client = new CompositeSttClient(whisper, elevenLabs);
    await expect(client.transcribe(wav)).resolves.toEqual({ text: 'مجھے مدد چاہیے', language: 'urd' });
  });
});

describe('looksLikeWrongUrdu', () => {
  it('rejects English guesses and keeps Roman Urdu', () => {
    expect(looksLikeWrongUrdu({ text: 'I need some help please', language: 'en' }, 'ur')).toBe(true);
    expect(looksLikeWrongUrdu({ text: 'mujhe madad chahiye', language: 'en' }, 'ur')).toBe(false);
    expect(looksLikeWrongUrdu({ text: 'مجھے مدد چاہیے', language: 'en' }, 'ur')).toBe(false);
  });
});

describe('pickPreferredSttTranscript', () => {
  it('prefers Arabic-script peer over ASCII English', () => {
    const preferred = pickPreferredSttTranscript([
      { text: 'I need help with bail please', language: 'en' },
      { text: 'مجھے ضمانت چاہیے', language: 'urd' },
    ]);
    expect(preferred?.text).toContain('ضمانت');
  });
});
