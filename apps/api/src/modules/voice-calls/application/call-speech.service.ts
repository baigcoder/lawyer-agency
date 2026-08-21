import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import type { Env } from '../../../config/env';
import { SPEECH_TO_TEXT, type SpeechToTextPort } from '../../voice/application/speech-to-text.port';
import { TEXT_TO_SPEECH, type TextToSpeechPort } from '../../voice/application/text-to-speech.port';
import type { AiSettings } from '../../firm-profile/application/ai-settings.dto';
import { prepareSpokenTtsText } from '../../voice/application/spoken-text';
import {
  pcmToWav,
  rawPcmTo48kMono,
  tonePcm48k,
  wavToPcm,
  upsampleTo48k,
  pcmBufferToInt16,
  monoFromStereo,
} from './pcm-audio';

@Injectable()
export class CallSpeechService {
  private readonly logger = new Logger(CallSpeechService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(SPEECH_TO_TEXT) private readonly stt: SpeechToTextPort,
    @Inject(TEXT_TO_SPEECH) private readonly tts: TextToSpeechPort,
  ) {}

  async transcribe(pcm48kMono: Int16Array, language: 'ur' | 'en'): Promise<string | null> {
    if (pcm48kMono.length < 48000 * 0.3) return null;
    const wav = pcmToWav(Buffer.from(pcm48kMono.buffer, pcm48kMono.byteOffset, pcm48kMono.byteLength), 48000, 1);
    try {
      const result = await this.stt.transcribe({
        audioBuffer: wav,
        mimeType: 'audio/wav',
        languageHint: language,
      });
      const text = result.text.trim();
      return text.length > 0 ? text : null;
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'stt' }, 'call STT failed');
      return null;
    }
  }

  async synthesize(text: string, settings: AiSettings): Promise<Int16Array> {
    const spoken = prepareSpokenTtsText(text);
    if (!spoken) return tonePcm48k(0.4, 440);
    const language = speechLanguage(spoken, settings.aiLanguagePolicy);

    if (this.tts.isConfigured()) {
      try {
        const result = await this.tts.synthesize({
          text: spoken,
          voiceGender: settings.aiVoiceGender,
          voiceId: settings.aiVoiceId || undefined,
          language,
          outputFormat: 'pcm_24000',
        });
        if (result.mimeType.includes('pcm')) {
          return rawPcmTo48kMono(result.audioBuffer, 24_000, 1);
        }
        this.logger.warn({ mimeType: result.mimeType }, 'TTS returned non-PCM; trying other engines');
      } catch (error) {
        this.logger.warn({ err: error instanceof Error ? error.message : 'tts' }, 'ElevenLabs call TTS failed');
      }
    }

    const openai = await this.openaiPcm(spoken, settings.aiVoiceGender);
    if (openai) return openai;

    const espeak = await this.espeakPcm(spoken, language);
    if (espeak) return espeak;

    this.logger.warn('no TTS engine available — playing tone');
    return tonePcm48k(0.55, 523);
  }

  async synthesizeWhatsappNote(
    text: string,
    settings: AiSettings,
  ): Promise<{ audioBuffer: Buffer; mimeType: string } | null> {
    if (!this.tts.isConfigured()) return null;
    const spoken = prepareSpokenTtsText(text);
    if (!spoken) return null;
    try {
      const result = await this.tts.synthesize({
        text: spoken,
        voiceGender: settings.aiVoiceGender,
        voiceId: settings.aiVoiceId || undefined,
        language: speechLanguage(spoken, settings.aiLanguagePolicy),
      });
      return { audioBuffer: result.audioBuffer, mimeType: result.mimeType };
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'tts' },
        'WhatsApp call follow-up voice note skipped',
      );
      return null;
    }
  }

  private async openaiPcm(text: string, gender: 'male' | 'female'): Promise<Int16Array | null> {
    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    const baseUrl = this.config.get('OPENAI_BASE_URL', { infer: true });
    if (!apiKey || baseUrl.includes('groq.com')) return null;
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/speech`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: gender === 'male' ? 'onyx' : 'nova',
          input: text,
          response_format: 'pcm',
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'OpenAI speech failed');
        return null;
      }
      return rawPcmTo48kMono(Buffer.from(await response.arrayBuffer()), 24_000, 1);
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'openai-tts' }, 'OpenAI speech failed');
      return null;
    }
  }

  private async espeakPcm(text: string, language: 'ur' | 'en'): Promise<Int16Array | null> {
    const wav = await spawnEspeak(text, language).catch(() => spawnEspeak(text, 'en').catch(() => null));
    if (!wav) return null;
    try {
      const parsed = wavToPcm(wav);
      const samples = pcmBufferToInt16(parsed.pcm);
      const mono = parsed.channels === 2 ? monoFromStereo(samples) : samples;
      return upsampleTo48k(mono, parsed.sampleRate);
    } catch {
      return null;
    }
  }
}

export function speechLanguage(text: string, policy: AiSettings['aiLanguagePolicy']): 'ur' | 'en' {
  if (policy === 'english_only') return 'en';
  if (policy === 'urdu_preferred') return 'ur';
  return /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
}

function spawnEspeak(text: string, language: 'ur' | 'en'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('espeak-ng', ['-v', language === 'ur' ? 'ur' : 'en', '-s', '145', '--stdout', text], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('espeak timeout'));
    }, 20_000);
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`espeak ${code ?? 'fail'}`));
    });
  });
}
