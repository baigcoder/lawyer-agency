import { describe, expect, it } from 'vitest';
import {
  canonicalizeEvolutionEvent,
  normalizeEvolutionMessage,
} from './evolution-webhook-ingest.service';

describe('canonicalizeEvolutionEvent', () => {
  it('maps Evolution v2 UPPER_SNAKE events onto dotted names', () => {
    expect(canonicalizeEvolutionEvent('MESSAGES_UPSERT')).toBe('messages.upsert');
    expect(canonicalizeEvolutionEvent('CONNECTION_UPDATE')).toBe('connection.update');
    expect(canonicalizeEvolutionEvent('messages.upsert')).toBe('messages.upsert');
  });
});

describe('normalizeEvolutionMessage', () => {
  it('maps image messages to IMAGE with mediaId', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '923001234567@s.whatsapp.net', id: 'msg-img-1' },
      { imageMessage: { caption: 'My CNIC front', mimetype: 'image/jpeg', fileName: 'cnic.jpg' } },
      { messageTimestamp: 1_700_000_000 },
    );

    expect(result).toMatchObject({
      wamid: 'msg-img-1',
      fromWaPhone: '923001234567',
      contentType: 'IMAGE',
      body: 'My CNIC front',
      mediaId: 'msg-img-1',
    });
    expect(result?.payload['mediaFilename']).toBe('cnic.jpg');
  });

  it('maps document messages to DOCUMENT with mediaId', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '923001234567@s.whatsapp.net', id: 'msg-doc-1' },
      {
        documentMessage: {
          caption: 'FIR copy',
          mimetype: 'application/pdf',
          fileName: 'fir.pdf',
        },
      },
      { messageTimestamp: 1_700_000_000 },
    );

    expect(result).toMatchObject({
      contentType: 'DOCUMENT',
      body: 'FIR copy',
      mediaId: 'msg-doc-1',
    });
    expect(result?.payload['mediaMimeType']).toBe('application/pdf');
  });

  it('maps audio to AUDIO without body text', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '923001234567@s.whatsapp.net', id: 'msg-aud-1' },
      { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 7, ptt: true } },
      { messageTimestamp: 1_700_000_000 },
    );

    expect(result).toMatchObject({
      contentType: 'AUDIO',
      body: null,
      mediaId: 'msg-aud-1',
    });
    expect(result?.payload['mediaMimeType']).toBe('audio/ogg; codecs=opus');
    expect(result?.payload['seconds']).toBe(7);
  });

  it('reads extendedTextMessage text used by WhatsApp for links and replies', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '923001234567@s.whatsapp.net', id: 'msg-ext-1' },
      { extendedTextMessage: { text: 'I need a lawyer' } },
      { messageTimestamp: 1_700_000_000, pushName: 'Ali' },
    );
    expect(result).toMatchObject({
      contentType: 'TEXT',
      body: 'I need a lawyer',
      fromDisplayName: 'Ali',
    });
  });

  it('resolves @lid senders to a real phone when senderPn is present', () => {
    const result = normalizeEvolutionMessage(
      {
        remoteJid: '123456789012345@lid',
        senderPn: '923001234567@s.whatsapp.net',
        id: 'msg-lid-1',
      },
      { conversation: 'Salaam' },
      { messageTimestamp: 1_700_000_000 },
    );
    expect(result?.fromWaPhone).toBe('923001234567');
    expect(result?.body).toBe('Salaam');
  });

  it('drops group chats', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '120363@g.us', id: 'msg-group-1' },
      { conversation: 'hello group' },
      { messageTimestamp: 1_700_000_000 },
    );
    expect(result).toBeNull();
  });

  it('unwraps ephemeral messages', () => {
    const result = normalizeEvolutionMessage(
      { remoteJid: '923001234567@s.whatsapp.net', id: 'msg-eph-1' },
      { ephemeralMessage: { message: { conversation: 'disappearing hello' } } },
      { messageTimestamp: 1_700_000_000 },
    );
    expect(result?.body).toBe('disappearing hello');
  });
});
