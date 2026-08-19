import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';

export interface WhisperRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function resolveWhisperConfig(config: ConfigService<Env, true>): WhisperRuntimeConfig | null {
  const dedicatedKey = config.get('OPENAI_WHISPER_API_KEY', { infer: true });
  const dedicatedBase = config.get('OPENAI_WHISPER_BASE_URL', { infer: true });
  const dedicatedModel = config.get('OPENAI_WHISPER_MODEL', { infer: true });

  const apiKey = dedicatedKey ?? config.get('OPENAI_API_KEY', { infer: true });
  if (!apiKey) return null;

  const chatBase = config.get('OPENAI_BASE_URL', { infer: true });
  const baseUrl = (dedicatedBase ?? chatBase).replace(/\/$/, '');

  if (dedicatedModel) {
    return { apiKey, baseUrl, model: dedicatedModel };
  }

  if (baseUrl.includes('groq.com')) {
    return { apiKey, baseUrl, model: 'whisper-large-v3-turbo' };
  }

  return { apiKey, baseUrl, model: 'whisper-1' };
}

export function whisperFilename(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('webm')) return 'audio.webm';
  return 'audio.ogg';
}
