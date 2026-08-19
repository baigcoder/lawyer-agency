import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type {
  SynthesizeInput,
  SynthesizeResult,
  TextToSpeechPort,
  TtsVoice,
} from '../application/text-to-speech.port';
import { buildElevenLabsTtsBody, resolveTtsLanguage } from './elevenlabs-tts.request';

export const DEFAULT_VOICE_MALE = 'pNInz6obpgDQGcFmaJgB';
export const DEFAULT_VOICE_FEMALE = 'EXAVITQu4vr4xnSDxMaL';
export const URDU_DEFAULT_VOICE_FEMALE = 'FGY2WhTYpPnrIDTdsKH5'; // Laura
export const URDU_DEFAULT_VOICE_MALE = 'JBFqnCBsd6RMkjVDRZzb'; // George

const CURATED_VOICES: TtsVoice[] = [
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', accent: 'Multilingual' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', accent: 'Multilingual' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', accent: 'Multilingual' },
  { id: DEFAULT_VOICE_FEMALE, name: 'Sarah', gender: 'female', accent: 'American' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', accent: 'British' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'male', accent: 'Multilingual' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', accent: 'Multilingual' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', accent: 'Multilingual' },
  { id: DEFAULT_VOICE_MALE, name: 'Adam', gender: 'male', accent: 'American' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', accent: 'British' },
];

interface ElevenLabsVoicePayload {
  voice_id?: unknown;
  name?: unknown;
  labels?: unknown;
}

@Injectable()
export class ElevenLabsTtsClient implements TextToSpeechPort {
  private readonly logger = new Logger(ElevenLabsTtsClient.name);
  private readonly apiKey: string | undefined;
  private readonly voiceMale: string;
  private readonly voiceFemale: string;
  private cachedVoices: { at: number; voices: TtsVoice[] } | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('ELEVENLABS_API_KEY', { infer: true });
    this.voiceMale = config.get('ELEVENLABS_VOICE_ID_MALE', { infer: true }) ?? DEFAULT_VOICE_MALE;
    this.voiceFemale = config.get('ELEVENLABS_VOICE_ID_FEMALE', { infer: true }) ?? DEFAULT_VOICE_FEMALE;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async listVoices(): Promise<TtsVoice[]> {
    if (!this.apiKey) return CURATED_VOICES;
    const fresh = this.cachedVoices && Date.now() - this.cachedVoices.at < 10 * 60 * 1000;
    if (fresh && this.cachedVoices) return this.cachedVoices.voices;

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'elevenlabs list voices failed');
        return CURATED_VOICES;
      }
      const payload: unknown = await response.json();
      const voices = parseVoiceList(payload);
      const merged = mergeVoices(CURATED_VOICES, voices);
      this.cachedVoices = { at: Date.now(), voices: merged };
      return merged;
    } catch (error) {
      this.logger.warn({ error }, 'elevenlabs list voices failed');
      return CURATED_VOICES;
    }
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const language = resolveTtsLanguage(input.text, input.language);
    const voiceId =
      input.voiceId?.trim() ||
      (language === 'ur'
        ? input.voiceGender === 'male'
          ? URDU_DEFAULT_VOICE_MALE
          : URDU_DEFAULT_VOICE_FEMALE
        : input.voiceGender === 'male'
          ? this.voiceMale
          : this.voiceFemale);
    const body = buildElevenLabsTtsBody({ text: input.text, language });
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': this.apiKey,
        accept: 'audio/mpeg',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      this.logger.warn({ status: response.status, body: text.slice(0, 200) }, 'elevenlabs tts failed');
      throw new Error(`ElevenLabs HTTP ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBuffer,
      mimeType: 'audio/mpeg',
      charactersUsed: input.text.length,
    };
  }
}

function parseVoiceList(payload: unknown): TtsVoice[] {
  if (typeof payload !== 'object' || payload === null || !('voices' in payload)) return [];
  const voices = (payload as { voices: unknown }).voices;
  if (!Array.isArray(voices)) return [];
  return voices.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as ElevenLabsVoicePayload;
    if (typeof row.voice_id !== 'string' || typeof row.name !== 'string') return [];
    const labels =
      typeof row.labels === 'object' && row.labels !== null
        ? (row.labels as Record<string, unknown>)
        : {};
    const genderRaw = typeof labels['gender'] === 'string' ? labels['gender'].toLowerCase() : '';
    const gender: TtsVoice['gender'] =
      genderRaw === 'male' ? 'male' : genderRaw === 'female' ? 'female' : 'neutral';
    const accent =
      typeof labels['accent'] === 'string' && labels['accent'].trim()
        ? titleCase(labels['accent'])
        : 'Multilingual';
    return [{ id: row.voice_id, name: row.name, gender, accent }];
  });
}

function mergeVoices(curated: TtsVoice[], fetched: TtsVoice[]): TtsVoice[] {
  const byId = new Map<string, TtsVoice>();
  for (const voice of [...curated, ...fetched]) {
    byId.set(voice.id, voice);
  }
  return Array.from(byId.values()).slice(0, 30);
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
