import { describe, expect, it } from 'vitest';
import { speechLanguage } from './call-speech.service';
import { bridgeOptionsFromEnv, noopSession } from './webrtc-bridge';

describe('speechLanguage', () => {
  it('mirrors Arabic-script as Urdu', () => {
    expect(speechLanguage('السلام علیکم', 'mirror')).toBe('ur');
    expect(speechLanguage('hello', 'mirror')).toBe('en');
  });

  it('honours policy overrides', () => {
    expect(speechLanguage('hello', 'urdu_preferred')).toBe('ur');
    expect(speechLanguage('السلام علیکم', 'english_only')).toBe('en');
  });
});

describe('bridgeOptionsFromEnv', () => {
  it('adds a UDP ICE range and TURN when configured', () => {
    const options = bridgeOptionsFromEnv({
      icePortMin: 40000,
      icePortMax: 40031,
      turnUrl: 'turn:turn.example:3478',
      turnUsername: 'user',
      turnCredential: 'secret',
    });
    expect(options.icePortRange).toEqual([40000, 40031]);
    expect(options.iceServers?.some((server) => server.urls === 'turn:turn.example:3478')).toBe(true);
  });
});

describe('noopSession', () => {
  it('is signaling-only and already closed', async () => {
    const session = noopSession();
    expect(session.media).toBe('signaling-only');
    expect(session.isClosed()).toBe(true);
    expect(await session.waitConnected(10)).toBe(false);
  });
});
