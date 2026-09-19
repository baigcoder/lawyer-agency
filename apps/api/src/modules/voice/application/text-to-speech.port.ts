export interface SynthesizeInput {
  text: string;
  voiceGender: 'male' | 'female';
  /** Voice for English text. Never used for Urdu — see `urduVoiceId`. */
  voiceId?: string | undefined;
  /**
   * Voice for Urdu text. Kept apart from `voiceId` because one voice served
   * both, so a firm that picked an English voice had its Urdu notes read with
   * English phonetics.
   */
  urduVoiceId?: string | undefined;
  language?: 'ur' | 'en' | undefined;
  outputFormat?: 'mp3' | 'pcm_24000' | undefined;
}

export interface SynthesizeResult {
  audioBuffer: Buffer;
  mimeType: string;
  /** Characters actually sent to the engine — what a per-character bill counts. */
  charactersUsed: number;
  /** Engine that produced this audio, so the spend can be priced and metered. */
  model: string;
  /** Voice that spoke it, so a preview can say which voice the client hears. */
  voiceId?: string | undefined;
}

export interface TtsVoice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  /** ElevenLabs' language label, e.g. `en` or `hi` (it has no Urdu label). */
  language?: string | undefined;
  /** Which reply languages this voice suits, for grouping the pickers. */
  recommendedFor?: Array<'en' | 'ur'> | undefined;
}

/** Voice used when a firm has not picked one, per language and gender. */
export type DefaultVoices = Record<'en' | 'ur', Record<'female' | 'male', string>>;

export interface VoiceLibrary {
  voices: TtsVoice[];
  /** False when `voices` is a built-in fallback rather than the firm's library. */
  complete: boolean;
  /** Why the library could not be read, for the settings screen to show. */
  reason?: string | undefined;
}

export interface TextToSpeechPort {
  isConfigured(): boolean;
  listVoices(): Promise<TtsVoice[]>;
  /** Optional richer form; falls back to `listVoices` when unimplemented. */
  loadVoices?(): Promise<VoiceLibrary>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
  /** The voices `synthesize` falls back to, so a picker can name them. */
  defaultVoices?(): DefaultVoices;
}

export const TEXT_TO_SPEECH = Symbol('TEXT_TO_SPEECH');
