import type { ConfigService } from '@nestjs/config';
import type { Env } from './env';

export interface OpenAiCompatibleRuntime {
  apiKey: string;
  baseUrl: string;
}

/** Groq is preferred when set — fast OpenAI-compatible chat for WhatsApp turns. */
export function resolveChatCompletionsRuntime(
  config: ConfigService<Env, true>,
): OpenAiCompatibleRuntime | null {
  const groqKey = config.get('GROQ_API_KEY', { infer: true });
  const groqBase = (config.get('GROQ_BASE_URL', { infer: true }) ?? 'https://api.groq.com/openai/v1').replace(
    /\/$/,
    '',
  );
  const openaiKey = config.get('OPENAI_API_KEY', { infer: true });
  const openaiBase = (config.get('OPENAI_BASE_URL', { infer: true }) ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );

  if (groqKey) return { apiKey: groqKey, baseUrl: groqBase };
  if (openaiKey) return { apiKey: openaiKey, baseUrl: openaiBase };
  return null;
}

export function isGroqBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('groq.com');
}
