import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { SynthesizeInput } from '../application/text-to-speech.port';
import { chunkText, parseWav, type PcmAudio } from './wav-audio';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Groq text-to-speech (Canopy Labs Orpheus, OpenAI-compatible `/audio/speech`).
 *
 * English only: Groq's Orpheus models are English and Saudi Arabic, so Urdu
 * replies skip this engine. Requests are capped in length, so long replies
 * are spoken in sentence chunks and joined. The model is gated: the Groq org
 * admin must accept its terms once in the console, otherwise every call fails
 * with `model_terms_required` and the chain moves to the next engine.
 */
@Injectable()
export class GroqTtsClient {
  private readonly logger = new Logger(GroqTtsClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly voices: Record<'female' | 'male', string>;
  private readonly maxChars: number;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('GROQ_API_KEY', { infer: true });
    this.baseUrl = (config.get('GROQ_BASE_URL', { infer: true }) ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '');
    this.model = config.get('GROQ_TTS_MODEL', { infer: true });
    this.voices = {
      female: config.get('GROQ_TTS_VOICE_FEMALE', { infer: true }),
      male: config.get('GROQ_TTS_VOICE_MALE', { infer: true }),
    };
    this.maxChars = config.get('GROQ_TTS_MAX_CHARS', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Whether this engine can speak `language` at all. */
  speaks(language: 'ur' | 'en'): boolean {
    return language === 'en';
  }

  get modelName(): string {
    return this.model;
  }

  async synthesize(input: SynthesizeInput, deadline: number): Promise<PcmAudio> {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is not configured');
    const voice = this.voices[input.voiceGender];
    const parts: PcmAudio[] = [];
    for (const chunk of chunkText(input.text, this.maxChars)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Groq TTS deadline exceeded');
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, voice, input: chunk, response_format: 'wav' }),
        signal: AbortSignal.timeout(Math.max(1_000, Math.min(REQUEST_TIMEOUT_MS, remaining))),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        this.logger.warn({ status: response.status, body: detail }, 'groq tts rejected');
        throw new Error(`Groq TTS HTTP ${response.status}`);
      }
      const audio = parseWav(Buffer.from(await response.arrayBuffer()));
      if (!audio || audio.channels !== 1) throw new Error('Groq TTS returned audio that is not mono 16-bit WAV');
      if (parts[0] && parts[0].sampleRate !== audio.sampleRate) throw new Error('Groq TTS sample rate changed mid-reply');
      parts.push(audio);
    }
    const first = parts[0];
    if (!first) throw new Error('Groq TTS: nothing to say');
    return { pcm: Buffer.concat(parts.map((p) => p.pcm)), sampleRate: first.sampleRate, channels: 1 };
  }
}
