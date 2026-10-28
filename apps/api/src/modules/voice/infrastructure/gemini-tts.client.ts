import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { SynthesizeInput } from '../application/text-to-speech.port';
import { parseWav, type PcmAudio } from './wav-audio';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Gemini text-to-speech (`generateContent` with an AUDIO response). Speaks
 * English and Urdu.
 *
 * Model quirks this handles, all observed against the live API:
 * - Some TTS models return raw 24 kHz PCM, others a whole WAV with a C2PA
 *   trailer; `parseWav` keeps only the samples.
 * - Some refuse a bare transcript ("Model tried to generate text") and need a
 *   short read-aloud instruction; newer ones may speak that instruction aloud,
 *   which the caller's duration check rejects.
 * - The free tier has a small per-model daily quota, so a second model is
 *   tried before giving up.
 */
@Injectable()
export class GeminiTtsClient {
  private readonly logger = new Logger(GeminiTtsClient.name);
  private readonly apiKey: string | undefined;
  private readonly models: string[];
  private readonly voices: Record<'female' | 'male', string>;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('GOOGLE_GENERATIVE_AI_API_KEY', { infer: true });
    this.models = [
      config.get('GEMINI_TTS_MODEL', { infer: true }),
      config.get('GEMINI_TTS_FALLBACK_MODEL', { infer: true }),
    ].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);
    this.voices = {
      female: config.get('GEMINI_TTS_VOICE_FEMALE', { infer: true }),
      male: config.get('GEMINI_TTS_VOICE_MALE', { infer: true }),
    };
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Speaks English and Urdu, so never skipped for language. */
  speaks(): boolean {
    return true;
  }

  /** Returns the audio and the model that produced it (for metering). */
  async synthesize(
    input: SynthesizeInput,
    language: 'ur' | 'en',
    deadline: number,
  ): Promise<{ audio: PcmAudio; model: string }> {
    if (!this.apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
    const instruction =
      language === 'ur'
        ? 'Read this Urdu text aloud in a calm, warm, professional voice:'
        : 'Read this aloud in a calm, warm, professional voice:';
    let lastError: Error = new Error('Gemini TTS: no model configured');

    for (const model of this.models) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        const response = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': this.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${instruction} ${input.text}` }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voices[input.voiceGender] } } },
            },
          }),
          signal: AbortSignal.timeout(Math.max(1_000, Math.min(REQUEST_TIMEOUT_MS, remaining))),
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          this.logger.warn({ status: response.status, model }, 'gemini tts rejected');
          lastError = new Error(`Gemini TTS HTTP ${response.status} (${model})`);
          continue;
        }
        const inline = findInlineAudio(body);
        if (!inline) {
          lastError = new Error(`Gemini TTS returned no audio (${model})`);
          continue;
        }
        const raw = Buffer.from(inline.data, 'base64');
        const audio = parseWav(raw) ?? {
          pcm: raw.subarray(0, raw.length - (raw.length % 2)),
          sampleRate: Number(/rate=(\d+)/.exec(inline.mimeType)?.[1] ?? 24_000),
          channels: 1,
        };
        return { audio, model };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn({ model, err: lastError.message }, 'gemini tts request failed');
      }
    }
    throw lastError;
  }
}

interface InlineAudio {
  data: string;
  mimeType: string;
}

/** `candidates[0].content.parts[*].inlineData`, validated without casts. */
export function findInlineAudio(body: unknown): InlineAudio | null {
  if (!isRecord(body) || !Array.isArray(body['candidates'])) return null;
  const candidate: unknown = body['candidates'][0];
  if (!isRecord(candidate) || !isRecord(candidate['content'])) return null;
  const parts: unknown = candidate['content']['parts'];
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!isRecord(part) || !isRecord(part['inlineData'])) continue;
    const { data, mimeType } = part['inlineData'];
    if (typeof data === 'string' && data.length > 0) {
      return { data, mimeType: typeof mimeType === 'string' ? mimeType : '' };
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
