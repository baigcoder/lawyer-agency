export interface TranscribeInput {
  audioBuffer: Buffer;
  mimeType: string;
  languageHint?: 'ur' | 'en' | undefined;
}

export interface TranscribeResult {
  text: string;
  language: string | null;
}

export interface SpeechToTextPort {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export const SPEECH_TO_TEXT = Symbol('SPEECH_TO_TEXT');
