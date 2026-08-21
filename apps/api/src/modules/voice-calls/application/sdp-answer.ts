/**
 * Build a WebRTC SDP answer from Meta's offer (D-124).
 * WhatsApp requires `a=setup:active` on the answer. ICE/DTLS still need a
 * real peer for media; this answer is enough to pre_accept/accept signaling.
 */
export function createSdpAnswerFromOffer(offer: string): string {
  const trimmed = offer.replace(/\r\n/g, '\n').trim();
  if (!trimmed.includes('v=0')) {
    throw new Error('SDP offer missing session line');
  }
  return trimmed
    .split('\n')
    .map((line) => {
      if (line.startsWith('o=')) {
        return line.replace(/^o=(\S+)/, 'o=wakeel');
      }
      if (line.startsWith('a=setup:')) return 'a=setup:active';
      return line;
    })
    .join('\r\n')
    .concat('\r\n');
}
