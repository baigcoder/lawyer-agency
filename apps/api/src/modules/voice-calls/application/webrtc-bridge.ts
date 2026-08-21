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

export interface HeldRtcSession {
  readonly media: 'live' | 'signaling-only';
  isClosed(): boolean;
  close(): void;
  sendPcm48kMono(pcm: Int16Array): Promise<void>;
  onIncomingPcm(handler: (pcm: Int16Array) => void): void;
  waitConnected(timeoutMs: number): Promise<boolean>;
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
    async sendPcm48kMono(pcm) {
      if (closed || pcm.length === 0) return;
      const padded = padToFrame(pcm, FRAME_SAMPLES);
      const stereo = stereoFromMono(padded);
      for (let offset = 0; offset + FRAME_SAMPLES * 2 <= stereo.length; offset += FRAME_SAMPLES * 2) {
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
      }
    },
  };
}

async function waitMsUntil(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start >= timeoutMs) return pred();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return true;
}
