import { describe, expect, it } from 'vitest';
import { isWavoipConfigured, probeWavoipNodePcm, sipConfigFromEnv } from './wavoip-bridge';

describe('wavoip-bridge SIP probe', () => {
  it('reports unconfigured without a token or SIP user', () => {
    expect(isWavoipConfigured({})).toBe(false);
    expect(probeWavoipNodePcm({})).toMatchObject({ configured: false, pcmAvailable: false });
  });

  it('marks PCM available when a token and SIP host are set', () => {
    expect(isWavoipConfigured({ token: 'device-token' })).toBe(true);
    const probe = probeWavoipNodePcm({ token: 'device-token', sipHost: 'sipv2.wavoip.com' });
    expect(probe.configured).toBe(true);
    expect(probe.pcmAvailable).toBe(true);
  });

  it('builds SIP credentials from the device token by default', () => {
    const cfg = sipConfigFromEnv({
      token: 'device-token',
      sipHost: 'sipv2.wavoip.com',
      sipPort: 5060,
    });
    expect(cfg).toMatchObject({
      user: 'device-token',
      password: 'device-token',
      host: 'sipv2.wavoip.com',
      localPort: 5060,
      rtpPortMin: 40000,
      rtpPortMax: 40031,
    });
  });
});
