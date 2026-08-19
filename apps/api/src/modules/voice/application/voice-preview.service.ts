import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { TEXT_TO_SPEECH, type TextToSpeechPort, type TtsVoice } from './text-to-speech.port';

export const voicePreviewInputSchema = z.object({
  voiceId: z.string().min(1).max(80),
  language: z.enum(['en', 'ur']),
});

export type VoicePreviewInput = z.infer<typeof voicePreviewInputSchema>;

const PREVIEW_TEXT = {
  en: "Hello, I'm the AI assistant for your law firm. How may I help you today?",
  ur: 'السلام علیکم، میں آپ کے قانونی دفتر کا معاون ہوں۔ میں آپ کی کیسے مدد کر سکتا ہوں؟',
} as const;

@Injectable()
export class VoicePreviewService {
  constructor(@Inject(TEXT_TO_SPEECH) private readonly tts: TextToSpeechPort) {}

  async listVoices(): Promise<{ configured: boolean; voices: TtsVoice[] }> {
    const voices = await this.tts.listVoices();
    return { configured: this.tts.isConfigured(), voices };
  }

  async preview(input: VoicePreviewInput): Promise<{ mimeType: string; audioBase64: string }> {
    if (!this.tts.isConfigured()) {
      throw new ServiceUnavailableException(
        'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to preview voices.',
      );
    }
    try {
      const result = await this.tts.synthesize({
        text: PREVIEW_TEXT[input.language],
        voiceId: input.voiceId,
        voiceGender: 'female',
        language: input.language,
      });
      return {
        mimeType: result.mimeType,
        audioBase64: result.audioBuffer.toString('base64'),
      };
    } catch {
      throw new BadGatewayException('Could not generate a voice preview. Try another voice.');
    }
  }
}
