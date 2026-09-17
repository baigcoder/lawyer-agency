export interface TranscribeInput {
  audioBuffer: Buffer;
  mimeType: string;
  /** Omit to let the provider auto-detect — used to lock a `mirror` call's language. */
  languageHint?: 'ur' | 'en' | undefined;
  /**
   * Optional decoding bias (Whisper's `prompt`). Short, noisy telephony audio
   * benefits a lot from domain vocabulary and from being told which language to
   * stay in. Providers that do not support it ignore it.
   */
  prompt?: string | undefined;
}

export interface TranscribeResult {
  text: string;
  language: string | null;
}

export interface SpeechToTextPort {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export const SPEECH_TO_TEXT = Symbol('SPEECH_TO_TEXT');
