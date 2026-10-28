import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type {
  DefaultVoices,
  SynthesizeInput,
  SynthesizeResult,
  TextToSpeechPort,
  TtsVoice,
  VoiceLibrary,
} from '../application/text-to-speech.port';
import { ElevenLabsTtsClient } from './elevenlabs-tts.client';
import { resolveTtsLanguage } from './elevenlabs-tts.request';
import { synthesizeWithEspeak } from './espeak-tts';
import { GeminiTtsClient } from './gemini-tts.client';
import { GroqTtsClient } from './groq-tts.client';
import { checkSpeech, pcmToWav, type PcmAudio } from './wav-audio';

export type TtsProvider = 'groq' | 'elevenlabs' | 'gemini';

/** Whole-chain budgets; a live caller tolerates far less silence than a chat. */
const NOTE_BUDGET_MS = 45_000;
const LIVE_BUDGET_MS = 14_000;
const LIVE_SAMPLE_RATE = 24_000;

/**
 * Text-to-speech across engines, in a configurable order (default
 * Groq → ElevenLabs → Gemini), then local espeak for voice notes.
 *
 * An engine is skipped when it is not configured or cannot speak the reply's
 * language (Groq's Orpheus is English-only), and passed over when it errors,
 * is out of quota, or returns audio that fails `checkSpeech` (silent, clipped,
 * truncated, or far too long — an engine reading its own instructions aloud).
 *
 * Voice pickers stay ElevenLabs-backed: a firm's saved voice ids are
 * ElevenLabs ids, and the other engines map gender to their own voices.
 */
@Injectable()
export class CompositeTtsClient implements TextToSpeechPort {
  private readonly logger = new Logger(CompositeTtsClient.name);
  private readonly order: TtsProvider[];

  constructor(
    config: ConfigService<Env, true>,
    private readonly elevenLabs: ElevenLabsTtsClient,
    private readonly groq: GroqTtsClient,
    private readonly gemini: GeminiTtsClient,
  ) {
    this.order = parseProviderOrder(config.get('TTS_PROVIDER_ORDER', { infer: true }));
  }

  isConfigured(): boolean {
    return this.elevenLabs.isConfigured() || this.groq.isConfigured() || this.gemini.isConfigured();
  }

  listVoices(): Promise<TtsVoice[]> {
    return this.elevenLabs.listVoices();
  }

  loadVoices(): Promise<VoiceLibrary> {
    return this.elevenLabs.loadVoices();
  }

  defaultVoices(): DefaultVoices {
    return this.elevenLabs.defaultVoices();
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const live = input.outputFormat === 'pcm_24000';
    const language = resolveTtsLanguage(input.text, input.language);
    const deadline = Date.now() + (live ? LIVE_BUDGET_MS : NOTE_BUDGET_MS);
    const failures: string[] = [];

    for (const provider of this.order) {
      if (Date.now() >= deadline) break;
      try {
        const result = await this.tryProvider(provider, input, language, live, deadline);
        if (result) {
          if (failures.length > 0) {
            this.logger.warn({ provider, language, skipped: failures }, 'tts fell back to a later engine');
          }
          return result;
        }
      } catch (error) {
        failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.warn({ language, live, failures }, 'every cloud tts engine failed');
    // A live call cannot take espeak's mp3/wav; the call loop handles the miss.
    if (live) throw new Error(`No text-to-speech engine succeeded: ${failures.join('; ') || 'none configured'}`);
    return synthesizeWithEspeak(input);
  }

  /** A result, or null when the engine does not apply (unconfigured / wrong language). */
  private async tryProvider(
    provider: TtsProvider,
    input: SynthesizeInput,
    language: 'ur' | 'en',
    live: boolean,
    deadline: number,
  ): Promise<SynthesizeResult | null> {
    if (provider === 'elevenlabs') {
      if (!this.elevenLabs.isConfigured()) return null;
      const result = await this.elevenLabs.synthesizeRemote(input);
      if (live) {
        const check = checkSpeech({ pcm: result.audioBuffer, sampleRate: LIVE_SAMPLE_RATE, channels: 1 }, input.text);
        if (!check.ok) throw new Error(`bad audio: ${check.reason}`);
      } else if (result.audioBuffer.length < 1_000) {
        throw new Error('bad audio: empty mp3');
      }
      return result;
    }

    if (provider === 'groq') {
      if (!this.groq.isConfigured() || !this.groq.speaks(language)) return null;
      const audio = await this.groq.synthesize(input, deadline);
      return this.accept(audio, input, live, `groq/${this.groq.modelName}`);
    }

    if (!this.gemini.isConfigured() || !this.gemini.speaks()) return null;
    const { audio, model } = await this.gemini.synthesize(input, language, deadline);
    return this.accept(audio, input, live, model);
  }

  /** Quality-gate PCM from an HTTP engine and shape it for notes (WAV) or calls (raw 24 kHz). */
  private accept(audio: PcmAudio, input: SynthesizeInput, live: boolean, model: string): SynthesizeResult {
    const check = checkSpeech(audio, input.text);
    if (!check.ok) throw new Error(`bad audio: ${check.reason}`);
    if (live) {
      const pcm = audio.sampleRate === LIVE_SAMPLE_RATE ? audio.pcm : resamplePcm(audio.pcm, audio.sampleRate, LIVE_SAMPLE_RATE);
      return { audioBuffer: pcm, mimeType: 'audio/pcm', charactersUsed: input.text.length, model };
    }
    return {
      audioBuffer: pcmToWav(audio.pcm, audio.sampleRate),
      mimeType: 'audio/wav',
      charactersUsed: input.text.length,
      model,
    };
  }
}

/** `groq,elevenlabs,gemini` → providers, ignoring unknowns and duplicates. */
export function parseProviderOrder(raw: string): TtsProvider[] {
  const known: readonly TtsProvider[] = ['groq', 'elevenlabs', 'gemini'];
  const order: TtsProvider[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim().toLowerCase();
    const provider = known.find((k) => k === name);
    if (provider && !order.includes(provider)) order.push(provider);
  }
  return order.length > 0 ? order : ['groq', 'elevenlabs', 'gemini'];
}

/** Linear-interpolation resample of mono 16-bit PCM (calls need exactly 24 kHz). */
export function resamplePcm(pcm: Buffer, from: number, to: number): Buffer {
  const inSamples = pcm.length / 2;
  const outSamples = Math.max(1, Math.round((inSamples * to) / from));
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const pos = (i * from) / to;
    const a = Math.min(inSamples - 1, Math.floor(pos));
    const b = Math.min(inSamples - 1, a + 1);
    const frac = pos - a;
    const v = pcm.readInt16LE(a * 2) * (1 - frac) + pcm.readInt16LE(b * 2) * frac;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i * 2);
  }
  return out;
}
