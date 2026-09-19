import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type {
  DefaultVoices,
  SynthesizeInput,
  SynthesizeResult,
  TextToSpeechPort,
  TtsVoice,
} from '../application/text-to-speech.port';
import {
  buildElevenLabsTtsBody,
  classifyTtsFailure,
  isValidVoiceId,
  resolveTtsLanguage,
  ttsBodyForModel,
  ttsModelPlan,
} from './elevenlabs-tts.request';
import { synthesizeWithEspeak } from './espeak-tts';

export const DEFAULT_VOICE_MALE = 'pNInz6obpgDQGcFmaJgB';
export const DEFAULT_VOICE_FEMALE = 'EXAVITQu4vr4xnSDxMaL';
export const URDU_DEFAULT_VOICE_FEMALE = 'FGY2WhTYpPnrIDTdsKH5'; // Laura
export const URDU_DEFAULT_VOICE_MALE = 'JBFqnCBsd6RMkjVDRZzb'; // George

const CURATED_VOICES: TtsVoice[] = ([
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
] satisfies TtsVoice[]).map((voice) => ({ ...voice, language: 'en', recommendedFor: ['en'] }));

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
  private readonly urduVoiceMale: string;
  private readonly urduVoiceFemale: string;
  private readonly urduNoteModel: string;
  private cachedVoices: { at: number; voices: TtsVoice[] } | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('ELEVENLABS_API_KEY', { infer: true });
    this.voiceMale = config.get('ELEVENLABS_VOICE_ID_MALE', { infer: true }) ?? DEFAULT_VOICE_MALE;
    this.voiceFemale = config.get('ELEVENLABS_VOICE_ID_FEMALE', { infer: true }) ?? DEFAULT_VOICE_FEMALE;
    // A Hindi/Urdu voice from the firm's own library, when they have one. The
    // built-in defaults are English voices that merely pronounce Urdu.
    this.urduVoiceMale =
      config.get('ELEVENLABS_VOICE_ID_URDU_MALE', { infer: true }) ?? URDU_DEFAULT_VOICE_MALE;
    this.urduVoiceFemale =
      config.get('ELEVENLABS_VOICE_ID_URDU_FEMALE', { infer: true }) ?? URDU_DEFAULT_VOICE_FEMALE;
    this.urduNoteModel = config.get('ELEVENLABS_URDU_NOTE_MODEL', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async listVoices(): Promise<TtsVoice[]> {
    return (await this.loadVoices()).voices;
  }

  /**
   * Voice list plus why it may be incomplete.
   *
   * A key without the `voices_read` permission 401s here, and this used to
   * return the curated English list as though it were the firm's library — so
   * a voice the firm had added (an Urdu or Hindi one, say) simply never
   * appeared in the picker, with nothing on screen to explain it.
   */
  async loadVoices(): Promise<{ voices: TtsVoice[]; complete: boolean; reason?: string }> {
    if (!this.apiKey) {
      return { voices: CURATED_VOICES, complete: false, reason: 'ELEVENLABS_API_KEY is not set.' };
    }
    const fresh = this.cachedVoices && Date.now() - this.cachedVoices.at < 10 * 60 * 1000;
    if (fresh && this.cachedVoices) return { voices: this.cachedVoices.voices, complete: true };

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'elevenlabs list voices failed');
        return { voices: CURATED_VOICES, complete: false, reason: voiceListReason(response.status) };
      }
      const payload: unknown = await response.json();
      const voices = parseVoiceList(payload);
      const merged = mergeVoices(CURATED_VOICES, voices);
      this.cachedVoices = { at: Date.now(), voices: merged };
      return { voices: merged, complete: true };
    } catch (error) {
      this.logger.warn({ error }, 'elevenlabs list voices failed');
      return {
        voices: CURATED_VOICES,
        complete: false,
        reason: 'Could not reach ElevenLabs. Showing the built-in voices only.',
      };
    }
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const pcm = input.outputFormat === 'pcm_24000';
    if (this.apiKey) {
      try {
        return await this.synthesizeElevenLabs(input, pcm);
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error.message : 'tts' },
          'elevenlabs tts failed — trying local espeak',
        );
        if (pcm) throw error;
      }
    } else if (pcm) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    return synthesizeWithEspeak(input);
  }

  private async synthesizeElevenLabs(input: SynthesizeInput, pcm: boolean): Promise<SynthesizeResult> {
    const language = resolveTtsLanguage(input.text, input.language);
    const voiceId = this.resolveVoiceId(input, language);
    const body = buildElevenLabsTtsBody({
      text: input.text,
      language,
      liveCall: pcm,
      voiceGender: input.voiceGender,
    });
    const format = pcm ? 'pcm_24000' : 'mp3_44100_64';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${format}`;

    // A whole-chain budget. Three sequential attempts at the old per-request
    // timeouts could spend 75s on one voice note, or leave a caller listening
    // to 40s of silence, before anything fell back to a local engine.
    const deadline = Date.now() + (pcm ? LIVE_BUDGET_MS : NOTE_BUDGET_MS);
    let lastStatus = 0;
    let lastError: Error | null = null;

    for (const model of ttsModelPlan({ language, liveCall: pcm, urduNoteModel: this.urduNoteModel })) {
      // Keeps voice_settings on every attempt (the English fallback used to send
      // text + model only, silently reverting the slower speaking rate) and
      // drops `language_code` for models that reject it.
      const attemptBody = ttsBodyForModel(body, model, language);

      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
        if (Date.now() >= deadline) break;

        let response: Response;
        try {
          response = await this.postTts(url, attemptBody, pcm, deadline);
        } catch (error) {
          // fetch rejects on timeouts and dropped sockets. This used to escape
          // the fallback chain entirely and fail the whole synthesis.
          lastError = error instanceof Error ? error : new Error(String(error));
          this.logger.warn({ model, attempt, err: lastError.message }, 'elevenlabs request failed');
          if (attempt + 1 < MAX_ATTEMPTS_PER_MODEL) await sleep(retryDelayMs(attempt));
          continue;
        }

        if (response.ok) {
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          return {
            audioBuffer,
            voiceId,
            mimeType: pcm ? 'audio/pcm' : 'audio/mpeg',
            // ElevenLabs bills the text it actually spoke, which is the
            // normalized and clipped body — not the caller's raw input.
            charactersUsed: attemptBody.text.length,
            model,
          };
        }

        lastStatus = response.status;
        const detail = await response.text().catch(() => 'unknown');
        const failure = classifyTtsFailure(response.status);
        this.logger.warn(
          { status: response.status, model, attempt, failure, body: detail.slice(0, 200) },
          'elevenlabs tts rejected',
        );
        if (failure === 'fatal') throw new Error(`ElevenLabs HTTP ${response.status}`);
        if (failure === 'next-model') break;
        // Rate limit or server fault: wait and retry this same model. Moving to
        // another model cannot clear a concurrency limit.
        if (attempt + 1 < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(retryAfterMs(response) ?? retryDelayMs(attempt));
        }
      }
    }

    throw new Error(
      lastStatus > 0
        ? `ElevenLabs HTTP ${lastStatus}`
        : `ElevenLabs request failed: ${lastError?.message ?? 'unknown'}`,
    );
  }

  /**
   * Falls back to a curated default when the tenant's stored `aiVoiceId` is not
   * a real ElevenLabs id — otherwise a typo means every synthesis 404s through
   * the whole chain before reaching espeak.
   */
  private resolveVoiceId(input: SynthesizeInput, language: 'ur' | 'en'): string {
    // The firm's pick for *this* language only. The English pick used to speak
    // Urdu too, reading Urdu script with English phonetics.
    const configured = (language === 'ur' ? input.urduVoiceId : input.voiceId)?.trim();
    if (configured) {
      if (isValidVoiceId(configured)) return configured;
      this.logger.warn({ voiceId: configured.slice(0, 12), language }, 'ignoring malformed voice id');
    }
    return this.defaultVoices()[language][input.voiceGender];
  }

  defaultVoices(): DefaultVoices {
    return {
      en: { female: this.voiceFemale, male: this.voiceMale },
      ur: { female: this.urduVoiceFemale, male: this.urduVoiceMale },
    };
  }

  private async postTts(url: string, body: object, pcm: boolean, deadline: number): Promise<Response> {
    const remaining = deadline - Date.now();
    const perRequest = pcm ? LIVE_REQUEST_TIMEOUT_MS : NOTE_REQUEST_TIMEOUT_MS;
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': this.apiKey ?? '',
        accept: pcm ? 'application/octet-stream' : 'audio/mpeg',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(1_000, Math.min(perRequest, remaining))),
    });
  }
}

/** Whole-chain budgets; a live caller tolerates far less silence than a chat. */
const LIVE_BUDGET_MS = 14_000;
const NOTE_BUDGET_MS = 30_000;
const LIVE_REQUEST_TIMEOUT_MS = 8_000;
const NOTE_REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS_PER_MODEL = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(400 * 2 ** attempt, 2_000);
  return Math.round(base * (0.5 + random() * 0.5));
}

/** ElevenLabs sends `retry-after` on concurrency rejections; honour it. */
export function retryAfterMs(response: Pick<Response, 'headers'>): number | null {
  const header = response.headers.get('retry-after')?.trim();
  if (!header) return null;
  const seconds = Number.parseFloat(header);
  if (Number.isNaN(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, 5_000);
}

export function voiceListReason(status: number): string {
  if (status === 401 || status === 403) {
    return 'The ElevenLabs API key cannot read your voice library (it needs the `voices_read` permission), so only the built-in voices are shown.';
  }
  if (status === 429) return 'ElevenLabs rate-limited the voice list. Showing the built-in voices for now.';
  return `ElevenLabs returned HTTP ${status} for the voice list. Showing the built-in voices only.`;
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
    const language =
      typeof labels['language'] === 'string' && labels['language'].trim()
        ? labels['language'].trim().toLowerCase()
        : undefined;
    return [
      {
        id: row.voice_id,
        name: row.name,
        gender,
        accent,
        ...(language ? { language } : {}),
        recommendedFor: voiceRecommendedFor(language, row.name),
      },
    ];
  });
}

/**
 * Which reply languages a voice suits. ElevenLabs has no Urdu language label —
 * its Urdu voices are tagged `hi` — so Hindi-labelled voices, and any voice
 * named for Urdu, are offered first for Urdu: they carry the retroflex and
 * aspirated sounds an English voice flattens. English-labelled voices are
 * offered for English. Anything else is listed under "other voices" in both.
 */
export function voiceRecommendedFor(language: string | undefined, name: string): Array<'en' | 'ur'> {
  const lang = language?.toLowerCase();
  if (lang === 'hi' || lang === 'ur' || /urdu/i.test(name)) return ['ur'];
  if (!lang || lang === 'en') return ['en'];
  return [];
}

/** Hard cap so a large library cannot bloat the settings payload. */
const MAX_LISTED_VOICES = 80;

/**
 * The firm's own library comes first, curated built-ins only fill the tail.
 *
 * With the curated English voices inserted first, a real account sat at 31
 * unique voices against a cap of 30 — and the one silently cut was the last
 * of the firm's own, which is exactly the voice someone had just added.
 */
export function mergeVoices(curated: TtsVoice[], fetched: TtsVoice[]): TtsVoice[] {
  const byId = new Map<string, TtsVoice>();
  for (const voice of [...fetched, ...curated]) {
    if (!byId.has(voice.id)) byId.set(voice.id, voice);
  }
  return Array.from(byId.values()).slice(0, MAX_LISTED_VOICES);
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
