import { describe, expect, it } from 'vitest';
import { normalizeMessage, webhookPayloadSchema } from './dto';

const baseMessage = {
  id: 'wamid.HBgMNTk',
  from: '923001234567',
  timestamp: '1786483000',
  type: 'text',
  text: { body: 'salam, I need help with a property dispute' },
};

describe('webhook payload schema (boundary validation)', () => {
  it('accepts a realistic Meta payload and ignores unknown fields', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '923211112222', phone_number_id: '555777' },
                contacts: [{ wa_id: '923001234567', profile: { name: 'Imran' } }],
                messages: [baseMessage],
                someFutureField: { nested: true },
              },
            },
          ],
        },
      ],
    };
    const parsed = webhookPayloadSchema.parse(payload);
    const value = parsed.entry[0]?.changes?.[0]?.value;
    expect(value?.metadata.phone_number_id).toBe('555777');
    expect(value?.messages).toHaveLength(1);
  });

  it('rejects payloads without the routing-critical phone_number_id', () => {
    expect(() =>
      webhookPayloadSchema.parse({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { metadata: {} } }] }],
      }),
    ).toThrow();
  });
});

describe('normalizeMessage', () => {
  it('maps text messages', () => {
    const n = normalizeMessage(baseMessage, 'Imran');
    expect(n).toMatchObject({
      wamid: 'wamid.HBgMNTk',
      fromWaPhone: '923001234567',
      fromDisplayName: 'Imran',
      contentType: 'TEXT',
      body: 'salam, I need help with a property dispute',
      mediaId: null,
    });
    expect(n.sentAt.getTime()).toBe(1786483000 * 1000);
  });

  it('maps media with caption and media id', () => {
    const n = normalizeMessage(
      { ...baseMessage, type: 'image', text: undefined, image: { id: 'media-9', caption: 'FIR photo' } } as never,
      null,
    );
    expect(n.contentType).toBe('IMAGE');
    expect(n.mediaId).toBe('media-9');
    expect(n.body).toBe('FIR photo');
  });

  it('maps interactive replies to their title', () => {
    const n = normalizeMessage(
      {
        ...baseMessage,
        type: 'interactive',
        text: undefined,
        interactive: { type: 'list_reply', list_reply: { id: 'slot-3', title: 'Thursday 3pm' } },
      } as never,
      null,
    );
    expect(n.contentType).toBe('INTERACTIVE');
    expect(n.body).toBe('Thursday 3pm');
    expect(n.payload['replyId']).toBe('slot-3');
  });

  it('never drops unknown types — lands as OTHER with raw type preserved', () => {
    const n = normalizeMessage({ ...baseMessage, type: 'ephemeral_future_type', text: undefined } as never, null);
    expect(n.contentType).toBe('OTHER');
    expect(n.payload['rawType']).toBe('ephemeral_future_type');
  });
});
