import { describe, expect, it } from 'vitest';
import { buildPaymentReceiptPdf } from './payment-receipt.pdf';

describe('buildPaymentReceiptPdf', () => {
  it('returns a PDF buffer', async () => {
    const pdf = await buildPaymentReceiptPdf({
      firmName: 'Talha Law Associates',
      clientName: 'Ayesha Khan',
      amountPkr: '3,000',
      method: 'Jazzcash',
      paidAt: 'Wed, 19 Aug 2026, 10:00',
      workLabel: 'Consultation appointment',
      appointmentLabel: 'Talha Butt on Thu, 20 Aug 2026, 09:00',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
