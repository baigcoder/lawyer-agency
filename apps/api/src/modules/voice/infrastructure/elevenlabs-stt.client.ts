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
  /**
   * The model that last worked. An account without `scribe_v2` access paid a
   * wasted round trip on every single transcription before falling to v1.
   */
  private preferredModel: string | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('ELEVENLABS_API_KEY', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.apiKey) throw new Error('Speech-to-text is not configured (set ELEVENLABS_API_KEY)');

    let lastError: Error | null = null;
    for (const model of sttModelOrder(this.preferredModel)) {
      try {
        const result = await this.transcribeWithModel(input, model);
        this.preferredModel = model;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn({ model, err: lastError.message }, 'elevenlabs scribe failed');
        // A bad key or a rate limit fails identically on the other model;
        // retrying it only burns a second request and more latency.
        if (isSttFatal(lastError)) break;
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

/** Try the model that worked last time first, then the rest in order. */
export function sttModelOrder(preferred: string | null): string[] {
  const rest = SCRIBE_MODELS.filter((model) => model !== preferred);
  return preferred ? [preferred, ...rest] : [...SCRIBE_MODELS];
}

/** Failures that the other Scribe model would hit identically. */
export function isSttFatal(error: Error): boolean {
  return /HTTP (401|403|429)\b/.test(error.message);
}
