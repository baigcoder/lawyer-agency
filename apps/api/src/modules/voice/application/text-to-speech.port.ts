export interface SynthesizeInput {
  text: string;
  voiceGender: 'male' | 'female';
  voiceId?: string | undefined;
  language?: 'ur' | 'en' | undefined;
}

export interface SynthesizeResult {
  audioBuffer: Buffer;
  mimeType: string;
  charactersUsed: number;
}

export interface TtsVoice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
}

export interface TextToSpeechPort {
  isConfigured(): boolean;
  listVoices(): Promise<TtsVoice[]>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}

export const TEXT_TO_SPEECH = Symbol('TEXT_TO_SPEECH');
