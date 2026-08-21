import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { TEXT_TO_SPEECH, type TextToSpeechPort, type TtsVoice } from './text-to-speech.port';

export const voicePreviewInputSchema = z.object({
  voiceId: z.string().min(1).max(80),
  language: z.enum(['en', 'ur']),
  voiceGender: z.enum(['male', 'female']).default('female'),
  tone: z.enum(['friendly', 'formal', 'concise']).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export type VoicePreviewInput = z.infer<typeof voicePreviewInputSchema>;

type PreviewTone = 'friendly' | 'formal' | 'concise';

/** Spoken-safe sample (no slash/dash punctuation TTS would read aloud). */
export function buildVoicePreviewText(input: {
  language: 'en' | 'ur';
  tone?: PreviewTone | undefined;
  displayName?: string | undefined;
}): string {
  const firm = sanitizeDisplayName(input.displayName) || (input.language === 'ur' ? 'دفتر' : 'the firm');
  const tone = input.tone ?? 'friendly';

  if (input.language === 'ur') {
    if (tone === 'formal') {
      return `السلام علیکم۔ میں ${firm} کا اسسٹنٹ ہوں، وکیل خود نہیں۔ بتائیں آپ کو کس طرح مدد چاہیے؟`;
    }
    if (tone === 'concise') {
      return `السلام علیکم، ${firm} کا اسسٹنٹ۔ بتائیں کیا چاہیے؟`;
    }
    return `السلام علیکم۔ میں ${firm} کا اسسٹنٹ ہوں، وکیل خود نہیں۔ بتائیں آپ کو کیا چاہیے؟`;
  }

  if (tone === 'formal') {
    return `Assalamualaikum. I am the assistant for ${firm}, not the lawyer. Please tell me how I can help.`;
  }
  if (tone === 'concise') {
    return `Assalamualaikum. ${firm} assistant. How can I help?`;
  }
  return `Assalamualaikum. I'm the assistant for ${firm}, not the lawyer. How can I help you today?`;
}

function sanitizeDisplayName(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/[*_`#~>]+/g, '')
    .replace(/\s*[—–―/]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

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
        text: buildVoicePreviewText(input),
        voiceId: input.voiceId,
        voiceGender: input.voiceGender,
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
