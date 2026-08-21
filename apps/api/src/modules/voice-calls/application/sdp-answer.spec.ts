import { describe, expect, it } from 'vitest';
import { createSdpAnswerFromOffer } from './sdp-answer';

const OFFER = [
  'v=0',
  'o=- 123 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=setup:actpass',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
].join('\n');

describe('createSdpAnswerFromOffer', () => {
  it('flips setup to active for WhatsApp Cloud Calling', () => {
    const answer = createSdpAnswerFromOffer(OFFER);
    expect(answer).toContain('a=setup:active');
    expect(answer).not.toContain('a=setup:actpass');
    expect(answer).toContain('o=wakeel');
  });

  it('rejects junk', () => {
    expect(() => createSdpAnswerFromOffer('not sdp')).toThrow(/session line/);
  });
});
