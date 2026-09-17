import { Injectable, Logger } from '@nestjs/common';
import { concatInt16, rmsInt16 } from './pcm-audio';
import { BARGE_IN_MS, BARGE_IN_RMS, pcmDurationMs, SPEECH_RMS, vadAction } from './call-vad';
import { CallSpeechService } from './call-speech.service';
import { line } from './call-language';
import type { HeldRtcSession } from './webrtc-bridge';
import { VoiceReceptionistService, type ReceptionistSession } from './voice-receptionist.service';

const CALL_LIMIT_MS = 8 * 60_000;

export interface MediaLoopInput {
  session: ReceptionistSession;
  rtc: HeldRtcSession;
  greeting: string;
  onHangUp: () => Promise<void>;
}

@Injectable()
export class CallMediaLoop {
  private readonly logger = new Logger(CallMediaLoop.name);

  constructor(
    private readonly speech: CallSpeechService,
    private readonly receptionist: VoiceReceptionistService,
  ) {}

  async run(input: MediaLoopInput): Promise<void> {
    const { session, rtc, greeting } = input;
    if (rtc.media !== 'live') {
      this.logger.warn({ voiceCallId: session.voiceCallId }, 'no live WebRTC media — call will be silent');
    }

    const connected = await rtc.waitConnected(12_000);
    this.logger.log(
      { voiceCallId: session.voiceCallId, connected, media: rtc.media },
      'voice media ICE wait finished',
    );

    let muteInbound = true;
    let hangUp = false;
    const chunks: Int16Array[] = [];
    let silenceMs = 0;
    let turn: Promise<void> = Promise.resolve();

    /** Non-null only while the assistant is speaking; aborting is barge-in. */
    let speaking: AbortController | null = null;
    let bargeInMs = 0;

    /**
     * Plays one spoken turn. Inbound audio stays unmuted during playback so the
     * caller can interrupt; without this the caller had to sit through every
     * word before being heard at all.
     */
    const speak = async (text: string): Promise<void> => {
      const pcm = await this.speech.synthesize(text, session.settings, session.language);
      const controller = new AbortController();
      speaking = controller;
      bargeInMs = 0;
      try {
        await rtc.sendPcm48kMono(pcm, { signal: controller.signal });
      } finally {
        if (speaking === controller) speaking = null;
      }
    };

    const flush = (): void => {
      if (chunks.length === 0) return;
      const pcm = concatInt16(chunks);
      chunks.length = 0;
      silenceMs = 0;
      turn = turn
        .then(async () => {
          if (rtc.isClosed() || hangUp) return;
          // Deaf only while thinking — playback below stays interruptible.
          muteInbound = true;
          try {
            // A `mirror` call is transcribed with auto-detect until the
            // caller's own words lock it; deriving the language from our own
            // last line pinned every call to English.
            const heard = await this.speech.transcribe(
              pcm,
              session.languageLocked ? session.language : null,
            );
            if (!heard) return;
            this.receptionist.lockLanguage(session, heard.text, heard.reportedLanguage);
            const reply = await this.receptionist.processUtterance(session, heard.text);
            muteInbound = false;
            await speak(reply);
            if (session.shouldHangUp) hangUp = true;
          } finally {
            muteInbound = false;
          }
        })
        .catch((error: unknown) => {
          muteInbound = false;
          this.logger.warn(
            { err: error instanceof Error ? error.message : 'turn' },
            'call turn failed',
          );
        });
    };

    rtc.onIncomingPcm((pcm) => {
      if (muteInbound || hangUp || rtc.isClosed()) return;
      const rms = rmsInt16(pcm);
      const frameMs = pcmDurationMs(pcm);

      if (speaking) {
        // Only a clearly louder, sustained voice cuts the assistant off, so
        // echo and room noise do not chop every reply in half.
        bargeInMs = rms >= BARGE_IN_RMS ? bargeInMs + frameMs : 0;
        if (bargeInMs < BARGE_IN_MS) return;
        this.logger.log({ voiceCallId: session.voiceCallId }, 'caller barged in — stopping playback');
        speaking.abort();
        speaking = null;
      }

      if (rms >= SPEECH_RMS) {
        chunks.push(pcm);
        silenceMs = 0;
      } else if (chunks.length > 0) {
        silenceMs += frameMs;
      }
      const bufferedMs = chunks.reduce((ms, chunk) => ms + pcmDurationMs(chunk), 0);
      if (vadAction(rms, bufferedMs, silenceMs) === 'flush') flush();
    });

    muteInbound = false;
    try {
      await speak(greeting);
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'greet' }, 'greeting TTS failed');
    }

    const deadline = Date.now() + CALL_LIMIT_MS;
    while (!rtc.isClosed() && !hangUp && Date.now() < deadline) {
      await sleep(80);
    }

    await turn.catch(() => undefined);
    if (hangUp || (!rtc.isClosed() && Date.now() >= deadline)) {
      if (!hangUp && !rtc.isClosed()) {
        try {
          await speak(line('callLimit', session.language));
        } catch {
          /* ignore */
        }
      }
      await input.onHangUp();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
