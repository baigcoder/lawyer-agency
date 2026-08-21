export interface WavoipProbeInput {
  token?: string | undefined;
  sipUser?: string | undefined;
  sipHost?: string | undefined;
}

export interface WavoipSpikeResult {
  configured: boolean;
  pcmAvailable: boolean;
  reason: string;
}

export interface WavoipSipConfig {
  host: string;
  registrarPort: number;
  user: string;
  password: string;
  contactHost: string | undefined;
  localPort: number;
  rtpPortMin: number;
  rtpPortMax: number;
}

/**
 * QR/Baileys live audio (D-124): Evolution relays `CB:call` to Wavoip when a
 * device token is set. The voice process REGISTERs that token as a SIP trunk
 * and answers G.711 INVITEs. Browser `wavoip-api` is not used.
 */
export function probeWavoipNodePcm(input: WavoipProbeInput): WavoipSpikeResult {
  const user = input.sipUser?.trim() || input.token?.trim();
  const host = input.sipHost?.trim() || 'sipv2.wavoip.com';
  if (!user) {
    return {
      configured: false,
      pcmAvailable: false,
      reason: 'WAVOIP_TOKEN or WAVOIP_SIP_USER is not set',
    };
  }
  return {
    configured: true,
    pcmAvailable: true,
    reason: `SIP REGISTER at ${host}`,
  };
}

export function isWavoipConfigured(input: WavoipProbeInput): boolean {
  return Boolean(input.sipUser?.trim() || input.token?.trim());
}

export function sipConfigFromEnv(env: {
  token?: string | undefined;
  sipHost: string;
  sipPort: number;
  sipUser?: string | undefined;
  sipPassword?: string | undefined;
  contactHost?: string | undefined;
  icePortMin?: number | undefined;
  icePortMax?: number | undefined;
}): WavoipSipConfig | undefined {
  const user = env.sipUser?.trim() || env.token?.trim();
  if (!user) return undefined;
  const password = env.sipPassword?.trim() || env.token?.trim() || user;
  const rtpMin = env.icePortMin ?? 40000;
  const rtpMax = env.icePortMax ?? 40031;
  return {
    host: env.sipHost,
    registrarPort: env.sipPort,
    user,
    password,
    contactHost: env.contactHost,
    localPort: env.sipPort,
    rtpPortMin: rtpMin,
    rtpPortMax: rtpMax > rtpMin ? rtpMax : rtpMin + 31,
  };
}
