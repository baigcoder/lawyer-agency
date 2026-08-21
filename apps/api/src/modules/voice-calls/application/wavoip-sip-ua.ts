import { randomUUID } from 'node:crypto';
import { generateTag, type SipHeaders, type SipRequest, type SipResponse } from '@vexyl.ai/sip';
import digest from '@vexyl.ai/sip/digest';
import { SipStack, type Dialog, type SipStackOptions } from '@vexyl.ai/sip/stack';
import {
  downsampleFrom48k,
  int16ToPcmBuffer,
  padToFrame,
  pcmBufferToInt16,
  upsampleTo48k,
} from './pcm-audio';
import { callerDigitsFromSip } from './sip-phone';
import { INVITE_CLAIM_TIMEOUT_MS, InvitePark } from './sip-invite-park';
import type { WavoipSipConfig } from './wavoip-bridge';
import type { HeldRtcSession } from './webrtc-bridge';

const REGISTER_EXPIRES_SEC = 120;
const REGISTER_TIMEOUT_MS = 8_000;

export interface SipUaLog {
  info(meta: Record<string, unknown>, msg: string): void;
  warn(meta: Record<string, unknown>, msg: string): void;
}

function headerValue(headers: SipHeaders, key: string): unknown {
  return Reflect.get(headers, key);
}

function readExpires(rs: SipResponse, fallback: number): number {
  const raw = headerValue(rs.headers, 'expires');
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const contactExp = rs.headers.contact?.[0]?.params?.expires;
  if (typeof contactExp === 'string') {
    const parsed = Number(contactExp);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function wrapSipSession(dialog: Dialog): HeldRtcSession {
  let closed = dialog.state === 'ended';
  let incoming: ((pcm: Int16Array) => void) | undefined;

  dialog.on('audio', (pcm) => {
    if (closed || !incoming) return;
    const copy = Buffer.from(pcm);
    incoming(upsampleTo48k(pcmBufferToInt16(copy), 8000));
  });
  dialog.on('end', () => {
    closed = true;
    incoming = undefined;
  });

  return {
    media: 'live',
    isClosed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      incoming = undefined;
      void dialog.bye().catch(() => undefined);
    },
    onIncomingPcm(handler) {
      incoming = handler;
    },
    async waitConnected() {
      return !closed && (dialog.state === 'active' || dialog.state === 'held');
    },
    async sendPcm48kMono(pcm) {
      if (closed || pcm.length === 0) return;
      const eightK = downsampleFrom48k(padToFrame(pcm, 960), 8000);
      await dialog.sendAudioPaced(int16ToPcmBuffer(eightK));
    },
  };
}

/**
 * Voice-process SIP user agent for Wavoip: REGISTER the device trunk, park
 * inbound INVITEs by caller digits, answer with G.711 PCMU RTP.
 */
export class WavoipSipUa {
  private stack: SipStack | undefined;
  private started = false;
  private registered = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private backoffMs = 5_000;
  private registerSeq = 0;
  private readonly registerCallId = randomUUID();
  private readonly fromTag = generateTag();
  private readonly park = new InvitePark<Dialog>();
  private readonly authCtx: Record<string, unknown> = {};

  constructor(
    private readonly cfg: WavoipSipConfig,
    private readonly log: SipUaLog,
  ) {}

  isStarted(): boolean {
    return this.started;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const options: SipStackOptions = {
      port: this.cfg.localPort,
      address: '0.0.0.0',
      // Wavoip (and VAPI trunks) expect TCP. TCP REGISTER keeps a connection
      // open so INVITEs reuse ct-state established — required behind
      // policy-drop firewalls / home NAT where unsolicited UDP 5060 is dropped.
      udp: true,
      tcp: true,
      rport: true,
      credentials: { user: this.cfg.user, password: this.cfg.password },
      rtpPortMin: this.cfg.rtpPortMin,
      rtpPortMax: this.cfg.rtpPortMax,
      maxConcurrentCalls: 4,
      // Keep the TCP registration flow alive — idle streams are closed at 120s.
      keepaliveTargets: [
        {
          uri: `sip:${this.cfg.host}:${this.cfg.registrarPort};transport=tcp`,
          interval: 10_000,
        },
      ],
      logger: {
        error: (err: unknown) => this.log.warn({ err: String(err) }, 'sip stack'),
        recv: (msg: unknown, remote: unknown) => {
          const method =
            msg && typeof msg === 'object' && 'method' in msg
              ? String((msg as { method?: unknown }).method ?? '')
              : '';
          const status =
            msg && typeof msg === 'object' && 'status' in msg
              ? Number((msg as { status?: unknown }).status)
              : undefined;
          if (method || status) {
            this.log.info({ method: method || null, status: status ?? null, remote }, 'SIP packet received');
          }
        },
      },
    };
    if (this.cfg.contactHost) {
      options.publicAddress = this.cfg.contactHost;
      options.hostname = this.cfg.contactHost;
    }
    const stack = new SipStack(options);
    stack.on('invite', (dialog) => {
      void this.onInvite(dialog);
    });
    stack.on('error', (err) => {
      this.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'sip stack error');
    });
    await stack.start();
    this.stack = stack;
    this.started = true;
    this.log.info(
      {
        host: this.cfg.host,
        port: this.cfg.localPort,
        contactHost: this.cfg.contactHost ?? null,
        user: this.cfg.user.slice(0, 8),
      },
      'SIP stack listening',
    );
    void this.registerCycle();
  }

  async stop(): Promise<void> {
    this.clearRefresh();
    this.park.clear();
    if (this.started && this.stack) {
      try {
        await this.registerOnce(0);
      } catch {
        /* unregister best-effort */
      }
    }
    this.registered = false;
    this.started = false;
    const stack = this.stack;
    this.stack = undefined;
    if (stack) await stack.stop();
  }

  async claimSession(fromWaPhone: string, timeoutMs = INVITE_CLAIM_TIMEOUT_MS): Promise<HeldRtcSession | null> {
    if (!this.started) return null;
    const dialog = await this.park.claim(fromWaPhone, timeoutMs);
    if (!dialog) return null;
    try {
      await dialog.accept({ payloadType: 0 });
      return wrapSipSession(dialog);
    } catch (error) {
      this.log.warn(
        { err: error instanceof Error ? error.message : 'accept' },
        'SIP INVITE accept failed',
      );
      await dialog.reject(480, 'Temporarily Unavailable').catch(() => undefined);
      return null;
    }
  }

  private async onInvite(dialog: Dialog): Promise<void> {
    try {
      await dialog.trying();
      await dialog.ringing();
    } catch (error) {
      this.log.warn(
        { err: error instanceof Error ? error.message : 'invite' },
        'SIP INVITE provisional failed',
      );
      return;
    }
    const from = dialog.request?.headers.from;
    const digits = callerDigitsFromSip({
      fromUri: typeof from?.uri === 'string' ? from.uri : undefined,
      fromName: from?.name,
      assertedIdentity: dialog.request ? headerValue(dialog.request.headers, 'p-asserted-identity') : undefined,
    });
    this.log.info(
      {
        digits,
        fromUri: typeof from?.uri === 'string' ? from.uri : undefined,
        fromName: from?.name,
      },
      'SIP INVITE parked',
    );
    dialog.on('end', () => this.park.drop(dialog));
    this.park.park(digits, dialog, INVITE_CLAIM_TIMEOUT_MS, (idle) => {
      this.log.warn({ digits }, 'SIP INVITE idle — no WhatsApp job claimed it');
      void idle.reject(480, 'Temporarily Unavailable').catch(() => undefined);
    });
  }

  private async registerCycle(): Promise<void> {
    if (!this.started) return;
    try {
      const expires = await this.registerOnce(REGISTER_EXPIRES_SEC);
      this.registered = true;
      this.backoffMs = 5_000;
      // Refresh well before expires so Contact stays reachable for INVITEs.
      const refreshMs = Math.min(90_000, Math.max(20_000, Math.floor(expires * 600)));
      this.log.info({ expires, refreshMs, contactHost: this.cfg.contactHost ?? null }, 'SIP REGISTER ok');
      this.scheduleRegister(refreshMs);
    } catch (error) {
      this.registered = false;
      this.log.warn(
        { err: error instanceof Error ? error.message : 'register' },
        'SIP REGISTER failed',
      );
      this.scheduleRegister(this.backoffMs);
      this.backoffMs = Math.min(60_000, this.backoffMs * 2);
    }
  }

  private scheduleRegister(delayMs: number): void {
    this.clearRefresh();
    this.refreshTimer = setTimeout(() => {
      void this.registerCycle();
    }, delayMs);
  }

  private clearRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private buildRegister(expires: number, seq: number): SipRequest {
    const user = encodeURIComponent(this.cfg.user);
    const aor = `sip:${user}@${this.cfg.host}`;
    // Advertise reachable Contact at the public IP. Host firewall must allow
    // TCP/UDP 5060; home routers must port-forward those to this machine.
    // (Contact=sip:user@sipv2.wavoip.com never delivers INVITEs to us.)
    const contactHost = this.cfg.contactHost ?? this.cfg.host;
    const contactUri = `sip:${user}@${contactHost}:${this.cfg.localPort};transport=tcp`;
    return {
      method: 'REGISTER',
      uri: `sip:${this.cfg.host}:${this.cfg.registrarPort};transport=tcp`,
      headers: {
        to: { uri: aor },
        from: { name: this.cfg.user, uri: aor, params: { tag: this.fromTag } },
        'call-id': this.registerCallId,
        cseq: { method: 'REGISTER', seq },
        contact: [{ uri: contactUri, params: { expires: String(expires), transport: 'tcp' } }],
        expires,
        'max-forwards': 70,
      },
    };
  }

  private async registerOnce(expires: number): Promise<number> {
    this.registerSeq += 1;
    const req = this.buildRegister(expires, this.registerSeq);
    const rs = await this.send(req);
    if (rs.status === 401 || rs.status === 407) {
      this.registerSeq += 1;
      req.headers.cseq = { method: 'REGISTER', seq: this.registerSeq };
      digest.signRequest(this.authCtx, req, rs, { user: this.cfg.user, password: this.cfg.password });
      const retry = await this.send(req);
      if (retry.status < 200 || retry.status >= 300) {
        throw new Error(`SIP REGISTER ${retry.status} ${retry.reason}`);
      }
      return readExpires(retry, expires);
    }
    if (rs.status < 200 || rs.status >= 300) {
      throw new Error(`SIP REGISTER ${rs.status} ${rs.reason}`);
    }
    return readExpires(rs, expires);
  }

  private send(message: SipRequest): Promise<SipResponse> {
    const stack = this.stack;
    if (!stack) return Promise.reject(new Error('SIP stack not started'));
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('SIP request timed out'));
      }, REGISTER_TIMEOUT_MS);
      stack.send(message, (rs) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(rs);
      });
    });
  }
}
