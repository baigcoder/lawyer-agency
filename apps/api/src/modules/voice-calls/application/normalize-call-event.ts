export type NormalizedCallEventKind = 'connect' | 'terminate';

export interface NormalizedCallEvent {
  kind: NormalizedCallEventKind;
  providerCallId: string;
  fromWaPhone: string;
  sdpOffer: string | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function digitsPhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const phone = value.split('@')[0]?.replace(/\D/g, '');
  return phone && phone.length >= 7 ? phone : undefined;
}

function isLidJid(value: unknown): boolean {
  return typeof value === 'string' && value.includes('@lid');
}

/** WhatsApp LIDs are long opaque ids — not E.164 mobiles we can message. */
export function looksLikeWhatsappLid(digits: string): boolean {
  return digits.length >= 14 && !digits.startsWith('92');
}

function callerPhone(callRow: Record<string, unknown>): string | undefined {
  const packet = asRecord(callRow['packet']);
  const packetAttrs = asRecord(packet?.['attrs']);
  const key = asRecord(callRow['key']);
  const candidates: unknown[] = [
    callRow['fromPn'],
    callRow['senderPn'],
    callRow['callerPn'],
    callRow['remoteJidAlt'],
    callRow['participantPn'],
    key?.['remoteJidAlt'],
    key?.['senderPn'],
    callRow['from'],
    callRow['caller'],
    packetAttrs?.['from'],
    key?.['remoteJid'],
  ];
  const phones: string[] = [];
  const lids: string[] = [];
  for (const candidate of candidates) {
    const digits = digitsPhone(candidate);
    if (!digits) continue;
    if (isLidJid(candidate) || looksLikeWhatsappLid(digits)) lids.push(digits);
    else phones.push(digits);
  }
  return phones[0] ?? lids[0];
}

function readSdp(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) return undefined;
  const session = asRecord(record['session']);
  const sdp = session?.['sdp'] ?? record['sdp'];
  return typeof sdp === 'string' && sdp.includes('v=0') ? sdp : undefined;
}

function firstContentItem(packet: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!packet) return undefined;
  const content = packet['content'];
  const first = Array.isArray(content) ? content[0] : content;
  return asRecord(first);
}

function readCallId(record: Record<string, unknown>): string | undefined {
  const id = record['id'] ?? record['callId'] ?? record['call_id'];
  if (typeof id === 'string' && id.length > 0) return id;
  const packet = asRecord(record['packet']);
  const attrs = asRecord(packet?.['attrs']);
  const packetId = attrs?.['id'] ?? attrs?.['call-id'];
  if (typeof packetId === 'string' && packetId.length > 0) return packetId;
  const nestedAttrs = asRecord(firstContentItem(packet)?.['attrs']);
  const nestedId = nestedAttrs?.['call-id'] ?? nestedAttrs?.['id'];
  return typeof nestedId === 'string' && nestedId.length > 0 ? nestedId : undefined;
}

function packetStatus(record: Record<string, unknown>): string {
  const nested = firstContentItem(asRecord(record['packet']));
  return typeof nested?.['tag'] === 'string' ? nested['tag'].toLowerCase() : '';
}

/**
 * Evolution CALL events (Cloud SDP and Baileys `{id,from,status}` / CB:call)
 * share enough shape to normalize here. Returns null when not a call.
 */
export function normalizeCallEvent(event: string, data: unknown): NormalizedCallEvent | null {
  const canonical = event.toLowerCase().replace(/_/g, '.');
  const record = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  if (!record) return null;

  const nestedCalls = record['calls'];
  const callRow = Array.isArray(nestedCalls) ? asRecord(nestedCalls[0]) : record;
  if (!callRow) return null;

  const packetTag = packetStatus(callRow);
  const status = String(
    callRow['event'] ?? callRow['status'] ?? callRow['state'] ?? packetTag ?? canonical,
  ).toLowerCase();
  const isTerminate =
    status.includes('terminate') ||
    status.includes('reject') ||
    status.includes('hangup') ||
    status === 'ended' ||
    packetTag.includes('terminate') ||
    canonical.includes('terminate');
  const isConnect =
    status.includes('connect') ||
    status.includes('offer') ||
    status.includes('ring') ||
    status === 'pre_accept' ||
    packetTag === 'offer' ||
    canonical === 'call' ||
    canonical === 'calls' ||
    canonical.includes('call');

  if (!isConnect && !isTerminate) return null;

  const providerCallId = readCallId(callRow);
  if (!providerCallId) return null;

  const from = callerPhone(callRow);
  if (!from) return null;

  return {
    kind: isTerminate ? 'terminate' : 'connect',
    providerCallId,
    fromWaPhone: from,
    sdpOffer: readSdp(callRow),
  };
}

export function isCallWebhookEvent(event: string): boolean {
  const canonical = event.toLowerCase().replace(/_/g, '.');
  return canonical === 'call' || canonical === 'calls' || canonical.startsWith('call.');
}
