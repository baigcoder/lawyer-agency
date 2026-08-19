import { describe, expect, it } from 'vitest';
import { isPaymentDetailsRequest, preferredInstructionMethod } from './payment-details-request';

describe('preferredInstructionMethod', () => {
  it('prefers JazzCash when the owner saved a wallet number', () => {
    expect(preferredInstructionMethod({ jazzcashNumber: '03001234567' })).toBe('JAZZCASH');
  });

  it('falls back to bank transfer when only an account number exists', () => {
    expect(preferredInstructionMethod({ accountNumber: '123456789' })).toBe('BANK_TRANSFER');
  });
});

describe('isPaymentDetailsRequest', () => {
  it('matches JazzCash and payment-detail phrasing', () => {
    expect(isPaymentDetailsRequest('please send JazzCash number')).toBe(true);
    expect(isPaymentDetailsRequest('easypaisa account details')).toBe(true);
    expect(isPaymentDetailsRequest('ادائیگی کی تفصیل بھیجیں')).toBe(true);
  });

  it('does not match unrelated legal narrative', () => {
    expect(isPaymentDetailsRequest('he hit me last night')).toBe(false);
    expect(isPaymentDetailsRequest('Hy')).toBe(false);
  });
});
