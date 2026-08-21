import { describe, expect, it } from 'vitest';
import { opusPayloadTypeFromOffer, sanitizeWhatsappAnswerSdp } from './sanitize-whatsapp-sdp';

describe('sanitizeWhatsappAnswerSdp', () => {
  it('forces setup:active and SHA-256 capitals, drops extra hashes', () => {
    const raw = [
      'v=0',
      'a=setup:actpass',
      'a=fingerprint:sha-256 AB:CD',
      'a=fingerprint:sha-384 EF:00',
      'a=fingerprint:sha-512 94:11',
    ].join('\n');
    const cleaned = sanitizeWhatsappAnswerSdp(raw);
    expect(cleaned).toContain('a=setup:active');
    expect(cleaned).not.toContain('actpass');
    expect(cleaned).toContain('a=fingerprint:SHA-256 AB:CD');
    expect(cleaned).not.toMatch(/sha-384/i);
    expect(cleaned).not.toMatch(/sha-512/i);
  });
});

describe('opusPayloadTypeFromOffer', () => {
  it('reads rtpmap', () => {
    expect(opusPayloadTypeFromOffer('a=rtpmap:111 opus/48000/2\n')).toBe(111);
    expect(opusPayloadTypeFromOffer('a=rtpmap:96 opus/48000/2\n')).toBe(96);
  });
});
