import { describe, expect, it } from 'vitest';
import { restoreAttempts } from './media-read.service';

describe('restoreAttempts', () => {
  it('uses the inbound Evolution key when present', () => {
    const attempts = restoreAttempts({ key: { id: 'in-1' }, message: { audioMessage: {} } }, {});
    expect(attempts[0]).toEqual({ key: { id: 'in-1' }, message: { audioMessage: {} } });
  });

  it('builds an outbound fromMe key from wamid and phone', () => {
    const attempts = restoreAttempts(
      { audioPath: 'tenants/t/outbound/1.mp3', mimeType: 'audio/mpeg' },
      { wamid: 'out-99', fromMe: true, waPhone: '+923001234567' },
    );
    expect(attempts).toEqual([
      {
        key: { id: 'out-99', fromMe: true, remoteJid: '923001234567@s.whatsapp.net' },
      },
    ]);
  });
});
