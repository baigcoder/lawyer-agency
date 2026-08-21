import { Injectable, Logger } from '@nestjs/common';
import { concatInt16, rmsInt16 } from './pcm-audio';
import { pcmDurationMs, SPEECH_RMS, vadAction } from './call-vad';
import { CallSpeechService, speechLanguage } from './call-speech.service';
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

    const flush = (): void => {
      if (chunks.length === 0) return;
      const pcm = concatInt16(chunks);
      chunks.length = 0;
      silenceMs = 0;
      turn = turn
        .then(async () => {
          if (rtc.isClosed() || hangUp) return;
          muteInbound = true;
          const language = speechLanguage(
            session.transcript.at(-1)?.text ?? '',
            session.settings.aiLanguagePolicy,
          );
          const heard = await this.speech.transcribe(pcm, language);
          if (!heard) {
            muteInbound = false;
            return;
          }
          const reply = await this.receptionist.processUtterance(session, heard);
          await rtc.sendPcm48kMono(await this.speech.synthesize(reply, session.settings));
          if (session.shouldHangUp) hangUp = true;
          muteInbound = false;
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
      if (rms >= SPEECH_RMS) {
        chunks.push(pcm);
        silenceMs = 0;
      } else if (chunks.length > 0) {
        silenceMs += frameMs;
      }
      const bufferedMs = chunks.reduce((ms, chunk) => ms + pcmDurationMs(chunk), 0);
      if (vadAction(rms, bufferedMs, silenceMs) === 'flush') flush();
    });

    try {
      await rtc.sendPcm48kMono(await this.speech.synthesize(greeting, session.settings));
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'greet' }, 'greeting TTS failed');
    }
    muteInbound = false;

    const deadline = Date.now() + CALL_LIMIT_MS;
    while (!rtc.isClosed() && !hangUp && Date.now() < deadline) {
      await sleep(80);
    }

    await turn.catch(() => undefined);
    if (hangUp || (!rtc.isClosed() && Date.now() >= deadline)) {
      if (!hangUp && !rtc.isClosed()) {
        try {
          await rtc.sendPcm48kMono(
            await this.speech.synthesize(
              'I need to end this call now. Please continue on WhatsApp.',
              session.settings,
            ),
          );
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
