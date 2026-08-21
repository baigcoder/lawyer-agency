/**
 * WhatsApp Cloud Calling is picky about SDP answers (D-124):
 * DTLS client role, SHA-256 fingerprint only, capital SHA-256 label.
 */
export function sanitizeWhatsappAnswerSdp(sdp: string): string {
  const lines = sdp.replace(/\r\n/g, '\n').trim().split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^a=fingerprint:sha-(384|512)\b/i.test(line)) continue;
    if (line.startsWith('a=setup:')) {
      out.push('a=setup:active');
      continue;
    }
    const fingerprint = /^a=fingerprint:sha-256\s+(.+)$/i.exec(line);
    if (fingerprint?.[1]) {
      out.push(`a=fingerprint:SHA-256 ${fingerprint[1]}`);
      continue;
    }
    out.push(line);
  }
  return `${out.join('\r\n')}\r\n`;
}

export function opusPayloadTypeFromOffer(offer: string): number {
  const match = /a=rtpmap:(\d+)\s+opus\/48000/i.exec(offer);
  const value = match?.[1] ? Number(match[1]) : 111;
  return Number.isInteger(value) && value > 0 ? value : 111;
}
