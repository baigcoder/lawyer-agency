import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import type { Env } from '../../../config/env';
import { INVITE_CLAIM_TIMEOUT_MS } from './sip-invite-park';
import { isWavoipConfigured, probeWavoipNodePcm, sipConfigFromEnv } from './wavoip-bridge';
import { WavoipSipUa } from './wavoip-sip-ua';
import type { HeldRtcSession } from './webrtc-bridge';

@Injectable()
export class WavoipCallService implements OnApplicationBootstrap, OnModuleDestroy {
  private ua: WavoipSipUa | undefined;
  private started = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly logger: Logger,
  ) {}

  token(): string | undefined {
    return this.config.get('WAVOIP_TOKEN', { infer: true });
  }

  isConfigured(): boolean {
    return isWavoipConfigured(this.probeInput());
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.started) return;
    this.started = true;
    if (this.config.get('API_ROLE', { infer: true }) !== 'voice') return;
    const cfg = sipConfigFromEnv({
      token: this.token(),
      sipHost: this.config.get('WAVOIP_SIP_HOST', { infer: true }),
      sipPort: this.config.get('WAVOIP_SIP_PORT', { infer: true }),
      sipUser: this.config.get('WAVOIP_SIP_USER', { infer: true }),
      sipPassword: this.config.get('WAVOIP_SIP_PASSWORD', { infer: true }),
      contactHost: this.config.get('WAVOIP_SIP_CONTACT_HOST', { infer: true }),
      icePortMin: this.config.get('WEBRTC_ICE_PORT_MIN', { infer: true }),
      icePortMax: this.config.get('WEBRTC_ICE_PORT_MAX', { infer: true }),
    });
    if (!cfg) {
      this.logger.warn(
        'WAVOIP_TOKEN is empty — QR live SIP is off; calls fall back to missed-call WhatsApp',
      );
      return;
    }
    if (!cfg.contactHost) {
      this.logger.warn(
        'WAVOIP_SIP_CONTACT_HOST is empty — Wavoip may not reach SIP/RTP behind Docker NAT',
      );
    }
    const ua = new WavoipSipUa(cfg, {
      info: (meta, msg) => this.logger.log({ ...meta }, msg),
      warn: (meta, msg) => this.logger.warn({ ...meta }, msg),
    });
    this.ua = ua;
    try {
      await ua.start();
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'sip' },
        'Wavoip SIP UA failed to start — QR calls will use missed-call WhatsApp',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    const ua = this.ua;
    this.ua = undefined;
    if (ua) await ua.stop();
  }

  /**
   * Claim a parked Wavoip SIP INVITE for this WhatsApp caller. Returns null
   * when SIP is down or no INVITE arrives in time so the runner can fall back
   * to missed-call WhatsApp.
   */
  async tryLiveSession(input: { fromWaPhone: string }): Promise<HeldRtcSession | null> {
    const probe = probeWavoipNodePcm(this.probeInput());
    this.logger.log({ ...probe, fromWaPhone: input.fromWaPhone }, 'wavoip SIP probe');
    if (!probe.pcmAvailable) return null;
    const ua = this.ua;
    if (!ua?.isStarted()) {
      this.logger.warn('Wavoip SIP UA not started — cannot claim INVITE');
      return null;
    }
    if (!ua.isRegistered()) {
      this.logger.warn('Wavoip SIP UA not registered — waiting for INVITE anyway');
    }
    const session = await ua.claimSession(input.fromWaPhone, INVITE_CLAIM_TIMEOUT_MS);
    if (!session) {
      this.logger.warn(
        { fromWaPhone: input.fromWaPhone, timeoutMs: INVITE_CLAIM_TIMEOUT_MS },
        'Wavoip SIP INVITE claim timed out',
      );
    }
    return session;
  }

  private probeInput() {
    return {
      token: this.token(),
      sipUser: this.config.get('WAVOIP_SIP_USER', { infer: true }),
      sipHost: this.config.get('WAVOIP_SIP_HOST', { infer: true }),
    };
  }
}
