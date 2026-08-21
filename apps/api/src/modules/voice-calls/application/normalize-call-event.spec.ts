import { describe, expect, it } from 'vitest';
import { isCallWebhookEvent, normalizeCallEvent } from './normalize-call-event';

describe('normalizeCallEvent', () => {
  it('maps a Cloud connect webhook with SDP', () => {
    const event = normalizeCallEvent('CALL', {
      id: 'wacid.ABC',
      from: '923001112233',
      event: 'connect',
      session: { sdp_type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' },
    });
    expect(event).toMatchObject({
      kind: 'connect',
      providerCallId: 'wacid.ABC',
      fromWaPhone: '923001112233',
    });
    expect(event?.sdpOffer).toContain('v=0');
  });

  it('maps a Baileys offer without SDP', () => {
    const event = normalizeCallEvent('CALL', {
      id: '1A2B3C',
      from: '923001112233@s.whatsapp.net',
      status: 'offer',
      isVideo: false,
    });
    expect(event).toEqual({
      kind: 'connect',
      providerCallId: '1A2B3C',
      fromWaPhone: '923001112233',
      sdpOffer: undefined,
    });
  });

  it('maps a Baileys CB:call packet', () => {
    const event = normalizeCallEvent('CALL', {
      event: 'CB:call',
      packet: {
        tag: 'call',
        attrs: { from: '923004445555@s.whatsapp.net', id: '1739456007-392' },
        content: [{ tag: 'offer', attrs: { 'call-id': '1739456007-392' } }],
      },
    });
    expect(event).toMatchObject({
      kind: 'connect',
      providerCallId: '1739456007-392',
      fromWaPhone: '923004445555',
    });
    expect(event?.sdpOffer).toBeUndefined();
  });

  it('prefers the real phone over a WhatsApp LID', () => {
    const event = normalizeCallEvent('CALL', {
      id: '1A2B3C',
      from: '223553148428390@lid',
      senderPn: '923007038803@s.whatsapp.net',
      status: 'offer',
    });
    expect(event?.fromWaPhone).toBe('923007038803');
  });

  it('maps a Baileys terminate', () => {
    const event = normalizeCallEvent('CALL', {
      id: '1A2B3C',
      from: '923001112233@s.whatsapp.net',
      status: 'terminate',
    });
    expect(event?.kind).toBe('terminate');
  });

  it('maps terminate', () => {
    const event = normalizeCallEvent('calls', {
      calls: [{ id: 'wacid.ABC', from: '923001112233', event: 'terminate' }],
    });
    expect(event?.kind).toBe('terminate');
  });

  it('ignores unrelated payloads', () => {
    expect(normalizeCallEvent('messages.upsert', { key: { id: 'x' } })).toBeNull();
  });
});

describe('isCallWebhookEvent', () => {
  it('accepts CALL and calls', () => {
    expect(isCallWebhookEvent('CALL')).toBe(true);
    expect(isCallWebhookEvent('calls')).toBe(true);
    expect(isCallWebhookEvent('MESSAGES_UPSERT')).toBe(false);
  });
});
