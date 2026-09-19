import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { TEXT_TO_SPEECH, type TextToSpeechPort, type TtsVoice } from './text-to-speech.port';

type VoiceLanguage = 'en' | 'ur';
type VoiceGender = 'female' | 'male';
export type NamedDefaults = Record<VoiceLanguage, Record<VoiceGender, { id: string; name: string }>>;


export const voicePreviewInputSchema = z.object({
  /** Empty means "the default for this language and gender" — what replies use. */
  voiceId: z.string().max(80).optional(),
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
  voiceGender?: 'male' | 'female' | undefined;
}): string {
  const firm = sanitizeDisplayName(input.displayName) || (input.language === 'ur' ? 'دفتر' : 'the firm');
  const tone = input.tone ?? 'friendly';
  // The possessive agrees with the speaker: a female voice is "کی اسسٹنٹ".
  const of = input.voiceGender === 'male' ? 'کا' : 'کی';

  if (input.language === 'ur') {
    if (tone === 'formal') {
      return `السلام علیکم۔ میں ${firm} ${of} اسسٹنٹ ہوں، وکیل خود نہیں۔ بتائیں آپ کو کس طرح مدد چاہیے؟`;
    }
    if (tone === 'concise') {
      return `السلام علیکم، ${firm} ${of} اسسٹنٹ۔ بتائیں کیا چاہیے؟`;
    }
    return `السلام علیکم۔ میں ${firm} ${of} اسسٹنٹ ہوں، وکیل خود نہیں۔ بتائیں آپ کو کیا چاہیے؟`;
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

  async listVoices(): Promise<{
    configured: boolean;
    voices: TtsVoice[];
    libraryComplete: boolean;
    libraryWarning?: string;
    defaults?: NamedDefaults;
  }> {
    const library = this.tts.loadVoices
      ? await this.tts.loadVoices()
      : { voices: await this.tts.listVoices(), complete: true };
    const defaults = this.namedDefaults(library.voices);
    return {
      configured: this.tts.isConfigured(),
      voices: library.voices,
      libraryComplete: library.complete,
      ...(library.reason ? { libraryWarning: library.reason } : {}),
      ...(defaults ? { defaults } : {}),
    };
  }

  /**
   * The voices replies fall back to, by name. The picker's "Default" used to be
   * labelled with — and previewed as — the first voice of that gender in the
   * list, which was not the voice clients actually heard.
   */
  private namedDefaults(voices: TtsVoice[]): NamedDefaults | undefined {
    const ids = this.tts.defaultVoices?.();
    if (!ids) return undefined;
    const name = (id: string) => voices.find((voice) => voice.id === id)?.name ?? id;
    const pair = (lang: VoiceLanguage) => ({
      female: { id: ids[lang].female, name: name(ids[lang].female) },
      male: { id: ids[lang].male, name: name(ids[lang].male) },
    });
    return { en: pair('en'), ur: pair('ur') };
  }

  async preview(input: VoicePreviewInput): Promise<{ mimeType: string; audioBase64: string; voiceId?: string }> {
    if (!this.tts.isConfigured()) {
      throw new ServiceUnavailableException(
        'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to preview voices.',
      );
    }
    try {
      // The same synthesis path as a real reply, voice picked per language,
      // so what the owner hears here is what a client will hear.
      const picked = input.voiceId?.trim() || undefined;
      const result = await this.tts.synthesize({
        text: buildVoicePreviewText(input),
        voiceGender: input.voiceGender,
        language: input.language,
        ...(input.language === 'ur' ? { urduVoiceId: picked } : { voiceId: picked }),
      });
      return {
        mimeType: result.mimeType,
        audioBase64: result.audioBuffer.toString('base64'),
        ...(result.voiceId ? { voiceId: result.voiceId } : {}),
      };
    } catch {
      throw new BadGatewayException('Could not generate a voice preview. Try another voice.');
    }
  }
}
