import { describe, expect, it } from 'vitest';
import { isGroqBaseUrl, resolveChatCompletionsRuntime } from './llm-runtime';

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as never;
}

describe('resolveChatCompletionsRuntime', () => {
  it('prefers Groq when GROQ_API_KEY is set', () => {
    const runtime = resolveChatCompletionsRuntime(
      mockConfig({
        GROQ_API_KEY: 'gsk_live',
        GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
        OPENAI_API_KEY: 'sk_openai',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      }),
    );
    expect(runtime).toEqual({
      apiKey: 'gsk_live',
      baseUrl: 'https://api.groq.com/openai/v1',
    });
  });

  it('falls back to OPENAI_* when Groq is unset', () => {
    const runtime = resolveChatCompletionsRuntime(
      mockConfig({
        OPENAI_API_KEY: 'sk_openai',
        OPENAI_BASE_URL: 'https://api.openai.com/v1/',
      }),
    );
    expect(runtime).toEqual({
      apiKey: 'sk_openai',
      baseUrl: 'https://api.openai.com/v1',
    });
  });

  it('returns null when no chat key is configured', () => {
    expect(resolveChatCompletionsRuntime(mockConfig({}))).toBeNull();
  });
});

describe('isGroqBaseUrl', () => {
  it('detects Groq hosts', () => {
    expect(isGroqBaseUrl('https://api.groq.com/openai/v1')).toBe(true);
    expect(isGroqBaseUrl('https://api.openai.com/v1')).toBe(false);
  });
});
