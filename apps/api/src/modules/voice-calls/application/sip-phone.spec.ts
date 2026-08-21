import { describe, expect, it } from 'vitest';
import { callerDigitsFromSip, phoneDigits, phonesMatch } from './sip-phone';

describe('sip-phone', () => {
  it('strips SIP/WhatsApp wrappers down to digits', () => {
    expect(phoneDigits('sip:+923001112233@sipv2.wavoip.com')).toBe('923001112233');
    expect(phoneDigits('923001112233@s.whatsapp.net')).toBe('923001112233');
    expect(phoneDigits('+92 300 1112233')).toBe('923001112233');
  });

  it('matches WhatsApp and SIP caller numbers that differ by country code', () => {
    expect(phonesMatch('923001112233', 'sip:+923001112233@sipv2.wavoip.com')).toBe(true);
    expect(phonesMatch('3001112233', '923001112233')).toBe(true);
    expect(phonesMatch('923001112233', '924009998877')).toBe(false);
    expect(phonesMatch('123', '1234567')).toBe(false);
  });

  it('prefers From URI then P-Asserted-Identity', () => {
    expect(
      callerDigitsFromSip({
        fromUri: 'sip:+5511987654321@sipv2.wavoip.com',
        fromName: 'Alice',
      }),
    ).toBe('5511987654321');
    expect(
      callerDigitsFromSip({
        fromUri: 'sip:wavoip@sipv2.wavoip.com',
        assertedIdentity: { uri: 'sip:+923004445555@sipv2.wavoip.com' },
      }),
    ).toBe('923004445555');
  });
});
