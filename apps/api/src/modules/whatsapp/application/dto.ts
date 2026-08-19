import { z } from 'zod';
import type { NormalizedInboundMessage } from '../../../common/messaging/inbound-message';

/**
 * The slice of Meta's webhook payload we depend on, validated at the
 * boundary. `z.looseObject` keeps the validation resilient when Meta adds
 * fields (they do, often) — we validate what we read, ignore the rest.
 */
const waMessageSchema = z.looseObject({
  id: z.string().min(1),
  from: z.string().min(8),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.looseObject({ body: z.string() }).optional(),
  image: z.looseObject({ id: z.string(), caption: z.string().optional() }).optional(),
  audio: z.looseObject({ id: z.string() }).optional(),
  video: z.looseObject({ id: z.string(), caption: z.string().optional() }).optional(),
  document: z
    .looseObject({ id: z.string(), caption: z.string().optional(), filename: z.string().optional() })
    .optional(),
  location: z
    .looseObject({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  interactive: z
    .looseObject({
      type: z.string(),
      button_reply: z.looseObject({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.looseObject({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
});

export const statusSchema = z.looseObject({
  id: z.string().min(1),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string().regex(/^\d+$/).optional(),
  errors: z.array(z.unknown()).optional(),
});

export type WaStatus = z.infer<typeof statusSchema>;

export const templateStatusUpdateSchema = z.looseObject({
  message_template_id: z.string().min(1),
  message_template_name: z.string().optional(),
  message_template_status: z.enum(['APPROVED', 'REJECTED', 'PAUSED', 'PENDING', 'DISABLED']),
  reason: z.string().optional(),
});

export type TemplateStatusUpdateDto = z.infer<typeof templateStatusUpdateSchema>;

export const webhookPayloadSchema = z.looseObject({
  object: z.string(),
  entry: z.array(
    z.looseObject({
      changes: z
        .array(
          z.looseObject({
            field: z.string().optional(),
            value: z.looseObject({
              metadata: z.looseObject({ phone_number_id: z.string().min(1) }),
              contacts: z
                .array(
                  z.looseObject({
                    wa_id: z.string(),
                    profile: z.looseObject({ name: z.string() }).optional(),
                  }),
                )
                .optional(),
              messages: z.array(waMessageSchema).optional(),
              statuses: z.array(statusSchema).optional(),
            }),
          }),
        )
        .optional(),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
type WaMessage = z.infer<typeof waMessageSchema>;

const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'document']);

/** Map one Meta message to our normalized shape. Unknown/future types land
 *  as OTHER with the raw payload preserved — nothing is silently dropped. */
export function normalizeMessage(
  message: WaMessage,
  displayName: string | null,
): NormalizedInboundMessage {
  const media = message.image ?? message.audio ?? message.video ?? message.document ?? null;
  const interactiveReply =
    message.interactive?.button_reply ?? message.interactive?.list_reply ?? null;
  // caption exists on image/video/document (not audio); access per-branch so
  // the looseObject index signature never widens the type.
  const mediaCaption =
    message.image?.caption ?? message.video?.caption ?? message.document?.caption ?? null;

  const contentType: NormalizedInboundMessage['contentType'] = MEDIA_TYPES.has(message.type)
    ? (message.type.toUpperCase() as NormalizedInboundMessage['contentType'])
    : message.type === 'text'
      ? 'TEXT'
      : message.type === 'location'
        ? 'LOCATION'
        : message.type === 'interactive'
          ? 'INTERACTIVE'
          : message.type === 'sticker'
            ? 'STICKER'
            : 'OTHER';

  return {
    wamid: message.id,
    fromWaPhone: message.from,
    fromDisplayName: displayName,
    contentType,
    body: message.text?.body ?? mediaCaption ?? interactiveReply?.title ?? null,
    mediaId: media?.id ?? null,
    payload: {
      rawType: message.type,
      ...(message.location ?? {}),
      ...(interactiveReply ? { replyId: interactiveReply.id } : {}),
      ...(message.document?.filename ? { filename: message.document.filename } : {}),
    },
    sentAt: new Date(Number(message.timestamp) * 1000),
  };
}
