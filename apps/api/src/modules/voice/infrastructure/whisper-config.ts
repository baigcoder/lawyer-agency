import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { isGroqBaseUrl, resolveChatCompletionsRuntime } from '../../../config/llm-runtime';

export interface WhisperRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function resolveWhisperConfig(config: ConfigService<Env, true>): WhisperRuntimeConfig | null {
  const dedicatedKey = config.get('OPENAI_WHISPER_API_KEY', { infer: true });
  const dedicatedBase = config.get('OPENAI_WHISPER_BASE_URL', { infer: true });
  const dedicatedModel = config.get('OPENAI_WHISPER_MODEL', { infer: true });

  if (dedicatedKey) {
    const chat = resolveChatCompletionsRuntime(config);
    const baseUrl = (dedicatedBase ?? chat?.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    return {
      apiKey: dedicatedKey,
      baseUrl,
      model: dedicatedModel ?? (isGroqBaseUrl(baseUrl) ? 'whisper-large-v3' : 'whisper-1'),
    };
  }

  const chat = resolveChatCompletionsRuntime(config);
  if (!chat) return null;

  if (dedicatedModel) {
    return { apiKey: chat.apiKey, baseUrl: chat.baseUrl, model: dedicatedModel };
  }

  if (isGroqBaseUrl(chat.baseUrl)) {
    return { apiKey: chat.apiKey, baseUrl: chat.baseUrl, model: 'whisper-large-v3' };
  }

  return { apiKey: chat.apiKey, baseUrl: chat.baseUrl, model: 'whisper-1' };
}

export function whisperFilename(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('webm')) return 'audio.webm';
  return 'audio.ogg';
}
