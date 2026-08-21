import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { SpeechToTextPort, TranscribeInput, TranscribeResult } from '../application/speech-to-text.port';
import { whisperFilename } from './whisper-config';

const SCRIBE_MODELS = ['scribe_v2', 'scribe_v1'] as const;

@Injectable()
export class ElevenLabsSttClient implements SpeechToTextPort {
  private readonly logger = new Logger(ElevenLabsSttClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('ELEVENLABS_API_KEY', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.apiKey) throw new Error('Speech-to-text is not configured (set ELEVENLABS_API_KEY)');

    let lastError: Error | null = null;
    for (const model of SCRIBE_MODELS) {
      try {
        return await this.transcribeWithModel(input, model);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn({ model, err: lastError.message }, 'elevenlabs scribe failed');
      }
    }
    throw lastError ?? new Error('ElevenLabs speech-to-text failed');
  }

  private async transcribeWithModel(input: TranscribeInput, model: string): Promise<TranscribeResult> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.audioBuffer)], { type: input.mimeType });
    form.append('file', blob, whisperFilename(input.mimeType));
    form.append('model_id', model);
    form.append('timestamps_granularity', 'none');
    form.append('tag_audio_events', 'false');
    const languageCode = elevenLabsLanguageCode(input.languageHint);
    if (languageCode) form.append('language_code', languageCode);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey ?? '' },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(`ElevenLabs STT HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    const data = (await response.json()) as { text?: unknown; language_code?: unknown };
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    const language = typeof data.language_code === 'string' ? data.language_code : null;
    return { text, language };
  }
}

export function elevenLabsLanguageCode(hint: TranscribeInput['languageHint']): string | undefined {
  if (hint === 'ur') return 'urd';
  if (hint === 'en') return 'eng';
  return undefined;
}
