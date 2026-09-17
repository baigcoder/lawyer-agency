export interface SynthesizeInput {
  text: string;
  voiceGender: 'male' | 'female';
  voiceId?: string | undefined;
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
}

export interface TtsVoice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
}

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
}

export const TEXT_TO_SPEECH = Symbol('TEXT_TO_SPEECH');
