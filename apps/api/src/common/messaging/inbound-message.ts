/**
 * Normalized inbound message — the one shape the rest of the platform sees.
 * Meta's webhook payload is verbose and versioned; it is parsed once, here,
 * and everything downstream depends only on this (D-004 language handling,
 * FR-MSG-* content types).
 */

export const INBOUND_CONTENT_TYPES = [
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'INTERACTIVE',
  'STICKER',
  'OTHER',
] as const;
export type InboundContentType = (typeof INBOUND_CONTENT_TYPES)[number];

export interface NormalizedInboundMessage {
  /** Meta message id — idempotency key downstream (FR-MSG-01). */
  wamid: string;
  /** Sender's WhatsApp number, E.164 without '+'. */
  fromWaPhone: string;
  /** Display name from the WhatsApp profile, when present. */
  fromDisplayName: string | null;
  contentType: InboundContentType;
  /** Text body for TEXT/INTERACTIVE replies; caption for media; null otherwise. */
  body: string | null;
  /** Media id for downloadable content (fetched on demand via Graph API). */
  mediaId: string | null;
  /** Structured extras: location coords, interactive reply ids, etc. */
  payload: Record<string, unknown>;
  /** Meta's timestamp for the message. */
  sentAt: Date;
}
