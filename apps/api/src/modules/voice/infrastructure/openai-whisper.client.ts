import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { SpeechToTextPort, TranscribeInput, TranscribeResult } from '../application/speech-to-text.port';
import { resolveWhisperConfig, whisperFilename } from './whisper-config';

@Injectable()
export class OpenAiWhisperClient implements SpeechToTextPort {
  private readonly logger = new Logger(OpenAiWhisperClient.name);
  private readonly runtime: ReturnType<typeof resolveWhisperConfig>;

  constructor(config: ConfigService<Env, true>) {
    this.runtime = resolveWhisperConfig(config);
  }

  isConfigured(): boolean {
    return Boolean(this.runtime);
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.runtime) {
      throw new Error('Speech-to-text is not configured (set GROQ_API_KEY or OPENAI_API_KEY)');
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.audioBuffer)], { type: input.mimeType });
    form.append('file', blob, whisperFilename(input.mimeType));
    form.append('model', this.runtime.model);
    if (input.languageHint) {
      form.append('language', input.languageHint);
    }

    const response = await fetch(`${this.runtime.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.runtime.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      this.logger.warn(
        { status: response.status, model: this.runtime.model, body: text.slice(0, 200) },
        'whisper transcription failed',
      );
      throw new Error(`Whisper HTTP ${response.status}`);
    }

    const data = (await response.json()) as { text?: string; language?: string };
    return {
      text: (data.text ?? '').trim(),
      language: typeof data.language === 'string' ? data.language : null,
    };
  }
}
