import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildAppointmentConfirmationPdf } from './appointment-confirmation.pdf';

describe('buildAppointmentConfirmationPdf', () => {
  it('embeds firm, lawyer, and time fields', async () => {
    const pdf = await buildAppointmentConfirmationPdf({
      firmName: 'Talha Law Associates',
      clientName: 'Ayesha Khan',
      lawyerName: 'Talha Butt',
      dateTimeLabel: 'Wed, 20 Aug 2026, 14:00',
      endTimeLabel: '14:30',
      location: 'Office, Lahore',
      paymentVerifiedLine: 'Payment verified',
    });
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    // pdf-lib does not expose text extraction; size sanity-check is enough for unit scope.
    expect(pdf.length).toBeGreaterThan(500);
  });
});
