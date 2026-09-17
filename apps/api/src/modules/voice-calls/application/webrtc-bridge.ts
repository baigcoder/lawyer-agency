import {
  RTCPeerConnection,
  RTCRtpCodecParameters,
  RtpHeader,
  RtpPacket,
  type RTCIceServer,
  type RTCRtpTransceiver,
} from 'werift';
import OpusScript from 'opusscript';
import { randomBytes } from 'node:crypto';
import { opusPayloadTypeFromOffer, sanitizeWhatsappAnswerSdp } from './sanitize-whatsapp-sdp';
import { createSdpAnswerFromOffer } from './sdp-answer';
import { monoFromStereo, padToFrame, stereoFromMono } from './pcm-audio';

const FRAME_SAMPLES = 960; // 20ms at 48kHz
const TIMESTAMP_STEP = 960;
export const FRAME_MS = 20;
/** Let the receiver's jitter buffer run this far ahead of real time. */
const PLAYOUT_LEAD_MS = 120;

export interface SpeakOptions {
  /** Aborting stops playback mid-sentence — this is how barge-in works. */
  signal?: AbortSignal | undefined;
}

export interface HeldRtcSession {
  readonly media: 'live' | 'signaling-only';
  isClosed(): boolean;
  close(): void;
  /** Resolves when the audio has been paced out, not when it was queued. */
  sendPcm48kMono(pcm: Int16Array, options?: SpeakOptions): Promise<void>;
  onIncomingPcm(handler: (pcm: Int16Array) => void): void;
  waitConnected(timeoutMs: number): Promise<boolean>;
}

/**
 * Wall-clock schedule for RTP frames.
 *
 * `sendRtp` transmits immediately, so sending every frame of a reply in one
 * loop delivers a whole spoken turn as a burst: the caller's jitter buffer
 * keeps a fraction of a second and drops the rest, which is heard as clipped
 * or garbled speech. Frames have to leave at the rate they are played.
 */
export function frameDelayMs(frameIndex: number, elapsedMs: number, leadMs = PLAYOUT_LEAD_MS): number {
  const dueAt = frameIndex * FRAME_MS - leadMs;
  return Math.max(0, Math.round(dueAt - elapsedMs));
}

export interface WhatsappBridgeOptions {
  iceServers?: RTCIceServer[];
  icePortRange?: [number, number];
}

export function bridgeOptionsFromEnv(input: {
  icePortMin?: number | undefined;
  icePortMax?: number | undefined;
  turnUrl?: string | undefined;
  turnUsername?: string | undefined;
  turnCredential?: string | undefined;
}): WhatsappBridgeOptions {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  if (input.turnUrl) {
    const turn: RTCIceServer = { urls: input.turnUrl };
    if (input.turnUsername) turn.username = input.turnUsername;
    if (input.turnCredential) turn.credential = input.turnCredential;
    iceServers.push(turn);
  }
  const options: WhatsappBridgeOptions = { iceServers };
  if (
    typeof input.icePortMin === 'number' &&
    typeof input.icePortMax === 'number' &&
    input.icePortMax > input.icePortMin
  ) {
    options.icePortRange = [input.icePortMin, input.icePortMax];
  }
  return options;
}

/**
 * Real WebRTC answer for WhatsApp Cloud Calling. Falls back to SDP rewrite
 * if werift cannot parse Meta's offer (signaling may succeed; audio will not).
 */
export async function answerWhatsappOffer(
  offerSdp: string,
  options: WhatsappBridgeOptions = {},
): Promise<{ sdpAnswer: string; session: HeldRtcSession }> {
  try {
    return await answerWithWerift(offerSdp, options);
  } catch {
    return {
      sdpAnswer: sanitizeWhatsappAnswerSdp(createSdpAnswerFromOffer(offerSdp)),
      session: noopSession(),
    };
  }
}

export function noopSession(): HeldRtcSession {
  return {
    media: 'signaling-only',
    isClosed() {
      return true;
    },
    close() {},
    async sendPcm48kMono() {},
    onIncomingPcm() {},
    async waitConnected() {
      return false;
    },
  };
}

async function answerWithWerift(
  offerSdp: string,
  options: WhatsappBridgeOptions,
): Promise<{ sdpAnswer: string; session: HeldRtcSession }> {
  const payloadType = opusPayloadTypeFromOffer(offerSdp);
  const iceServers = options.iceServers ?? [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  const pc = new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
    iceUseIpv6: false,
    ...(options.icePortRange ? { icePortRange: options.icePortRange } : {}),
    codecs: {
      audio: [
        new RTCRtpCodecParameters({
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
          payloadType,
        }),
      ],
    },
  });
  const audio = pc.addTransceiver('audio', { direction: 'sendrecv' });
  const encoder = new OpusScript(48000, 2, OpusScript.Application.VOIP);
  const decoder = new OpusScript(48000, 2, OpusScript.Application.VOIP);
  encoder.setBitrate(32_000);

  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp.replace(/\r\n/g, '\n') });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitMsUntil(() => pc.iceGatheringState === 'complete', 2_500);

  const raw = pc.localDescription?.sdp;
  if (!raw) {
    encoder.delete();
    decoder.delete();
    await pc.close();
    throw new Error('werift produced no SDP');
  }
  const sdpAnswer = sanitizeWhatsappAnswerSdp(raw);
  return {
    sdpAnswer,
    session: liveSession(pc, audio, encoder, decoder, payloadType),
  };
}

function liveSession(
  pc: RTCPeerConnection,
  audio: RTCRtpTransceiver,
  encoder: OpusScript,
  decoder: OpusScript,
  payloadType: number,
): HeldRtcSession {
  let seq = randomBytes(2).readUInt16BE(0);
  let timestamp = randomBytes(4).readUInt32BE(0);
  const ssrc = audio.sender.ssrc;
  let incoming: ((pcm: Int16Array) => void) | undefined;
  let closed = false;

  const onRtp = (rtp: { payload: Buffer }): void => {
    if (closed || !incoming) return;
    try {
      const decoded = decoder.decode(rtp.payload);
      const samples = new Int16Array(decoded.buffer, decoded.byteOffset, decoded.length / 2);
      incoming(samples.length % 2 === 0 ? monoFromStereo(samples) : samples);
    } catch {
      // drop a bad frame
    }
  };

  audio.onTrack.subscribe((track) => {
    track.onReceiveRtp.subscribe(onRtp);
  });
  pc.onTrack.subscribe((track) => {
    track.onReceiveRtp.subscribe(onRtp);
  });

  return {
    media: 'live',
    isClosed() {
      return closed;
    },
    close() {
      closed = true;
      incoming = undefined;
      try {
        encoder.delete();
      } catch {
        /* ignore */
      }
      try {
        decoder.delete();
      } catch {
        /* ignore */
      }
      void pc.close();
    },
    onIncomingPcm(handler) {
      incoming = handler;
    },
    async waitConnected(timeoutMs) {
      if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') return true;
      return waitMsUntil(
        () =>
          pc.connectionState === 'connected' ||
          pc.iceConnectionState === 'connected' ||
          pc.iceConnectionState === 'completed',
        timeoutMs,
      );
    },
    async sendPcm48kMono(pcm, options) {
      if (closed || pcm.length === 0) return;
      const padded = padToFrame(pcm, FRAME_SAMPLES);
      const stereo = stereoFromMono(padded);
      const startedAt = Date.now();
      let frameIndex = 0;
      for (let offset = 0; offset + FRAME_SAMPLES * 2 <= stereo.length; offset += FRAME_SAMPLES * 2) {
        if (closed || options?.signal?.aborted) return;
        const frame = stereo.subarray(offset, offset + FRAME_SAMPLES * 2);
        const encoded = encoder.encode(
          Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength),
          FRAME_SAMPLES,
        );
        seq = (seq + 1) & 0xffff;
        timestamp = (timestamp + TIMESTAMP_STEP) >>> 0;
        const packet = new RtpPacket(
          new RtpHeader({
            payloadType,
            sequenceNumber: seq,
            timestamp,
            ssrc,
            marker: offset === 0,
          }),
          encoded,
        );
        await audio.sender.sendRtp(packet);
        frameIndex += 1;
        const wait = frameDelayMs(frameIndex, Date.now() - startedAt);
        if (wait > 0) await sleepMs(wait);
      }
    },
  };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitMsUntil(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start >= timeoutMs) return pred();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return true;
}
