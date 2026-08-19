import { describe, expect, it } from 'vitest';
import { resolveWhisperConfig, whisperFilename } from './whisper-config';

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as never;
}

describe('resolveWhisperConfig', () => {
  it('uses whisper-large-v3-turbo on Groq', () => {
    const cfg = resolveWhisperConfig(
      mockConfig({
        OPENAI_API_KEY: 'gsk_test',
        OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
      }),
    );
    expect(cfg?.model).toBe('whisper-large-v3-turbo');
    expect(cfg?.baseUrl).toContain('groq.com');
  });

  it('uses whisper-1 on OpenAI', () => {
    const cfg = resolveWhisperConfig(
      mockConfig({
        OPENAI_API_KEY: 'sk_test',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      }),
    );
    expect(cfg?.model).toBe('whisper-1');
  });

  it('honours dedicated whisper overrides', () => {
    const cfg = resolveWhisperConfig(
      mockConfig({
        OPENAI_API_KEY: 'gsk_chat',
        OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
        OPENAI_WHISPER_API_KEY: 'sk_whisper',
        OPENAI_WHISPER_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_WHISPER_MODEL: 'whisper-1',
      }),
    );
    expect(cfg).toEqual({
      apiKey: 'sk_whisper',
      baseUrl: 'https://api.openai.com/v1',
      model: 'whisper-1',
    });
  });
});

describe('whisperFilename', () => {
  it('maps common mime types', () => {
    expect(whisperFilename('audio/mpeg')).toBe('audio.mp3');
    expect(whisperFilename('audio/ogg')).toBe('audio.ogg');
  });
});
