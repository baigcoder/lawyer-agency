import { Injectable, Logger } from '@nestjs/common';
import type { SpeechToTextPort, TranscribeInput, TranscribeResult } from '../application/speech-to-text.port';
import { ElevenLabsSttClient } from './elevenlabs-stt.client';
import { OpenAiWhisperClient } from './openai-whisper.client';
import { prepareSttAudio } from './prepare-stt-audio';

const ROMAN_URDU =
  /\b(kya|kia|hai|hun|houn|mein|main|aap|mujhe|madad|chahiye|theek|nahi|nahin|haan|han|salam|ustad|ustaad|khana|baat|masla|vakil|wakeel)\b/i;

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * Race Groq Whisper (fast) with ElevenLabs Scribe (accurate Urdu).
 * Arabic-script transcripts beat ASCII English; English-looking Urdu guesses wait for Scribe.
 */
@Injectable()
export class CompositeSttClient implements SpeechToTextPort {
  private readonly logger = new Logger(CompositeSttClient.name);

  constructor(
    private readonly whisper: OpenAiWhisperClient,
    private readonly elevenLabs: ElevenLabsSttClient,
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const prepared = await prepareSttAudio(input.audioBuffer, input.mimeType);
    const next: TranscribeInput = {
      audioBuffer: prepared.buffer,
      mimeType: prepared.mimeType,
      languageHint: input.languageHint,
    };

    const jobs: Array<{ name: string; run: () => Promise<TranscribeResult> }> = [];
    if (this.elevenLabs.isConfigured()) {
      jobs.push({ name: 'elevenlabs', run: () => this.elevenLabs.transcribe(next) });
    }
    if (this.whisper.isConfigured()) {
      jobs.push({ name: 'whisper', run: () => this.whisper.transcribe(next) });
    }
    if (jobs.length === 0) {
      throw new Error('Speech-to-text is not configured (set ELEVENLABS_API_KEY or GROQ_API_KEY)');
    }

    const errors: string[] = [];
    const fallbacks: TranscribeResult[] = [];
    let remaining = jobs.length;

    return await new Promise<TranscribeResult>((resolve, reject) => {
      let decided = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const succeed = (result: TranscribeResult, provider: string) => {
        if (decided) return;
        decided = true;
        for (const timer of timers) clearTimeout(timer);
        this.logger.log({ provider, chars: result.text.length }, 'stt transcript ready');
        resolve(result);
      };

      const bestFallback = () => pickPreferredSttTranscript(fallbacks);

      const failIfLast = () => {
        remaining -= 1;
        if (decided || remaining > 0) return;
        const fallback = bestFallback();
        if (fallback) {
          succeed(fallback, 'fallback');
          return;
        }
        reject(new Error(errors[0] ?? 'Speech-to-text returned an empty transcript'));
      };

      for (const job of jobs) {
        job
          .run()
          .then((result) => {
            if (decided) return;
            if (!result.text.trim()) {
              errors.push(`${job.name}: empty transcript`);
              failIfLast();
              return;
            }
            // Arabic-script wins immediately over any pending ASCII peer.
            if (hasArabicScript(result.text)) {
              succeed(result, job.name);
              return;
            }
            const shouldWaitForPeer =
              remaining > 1 &&
              (looksLikeWrongUrdu(result, input.languageHint) || isMostlyAsciiEnglish(result.text));
            if (shouldWaitForPeer) {
              fallbacks.push(result);
              this.logger.warn({ provider: job.name }, 'stt ASCII candidate — waiting for Arabic-script peer');
              timers.push(
                setTimeout(() => {
                  if (!decided) succeed(bestFallback() ?? result, `${job.name}-waited`);
                }, 4_000),
              );
              return;
            }
            succeed(result, job.name);
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${job.name}: ${message}`);
            this.logger.warn({ provider: job.name, err: message }, 'stt provider failed');
            failIfLast();
          });
      }
    });
  }
}

export function hasArabicScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

export function isMostlyAsciiEnglish(text: string): boolean {
  const trimmed = text.trim();
  return /^[\x00-\x7F]+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2;
}

/** Prefer Nastaliq/Arabic-script transcripts over ASCII English guesses. */
export function pickPreferredSttTranscript(candidates: TranscribeResult[]): TranscribeResult | undefined {
  if (candidates.length === 0) return undefined;
  const withArabic = candidates.find((c) => hasArabicScript(c.text));
  return withArabic ?? candidates[0];
}

export function looksLikeWrongUrdu(result: TranscribeResult, hint?: TranscribeInput['languageHint']): boolean {
  if (hint !== 'ur') return false;
  const text = result.text.trim();
  if (hasArabicScript(text)) return false;
  const lang = (result.language ?? '').toLowerCase();
  if (lang.startsWith('ur')) return false;
  if (ROMAN_URDU.test(text)) return false;
  return isMostlyAsciiEnglish(text) && text.split(/\s+/).length >= 3;
}
